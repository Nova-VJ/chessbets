import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const USER_AGENT = "GameChessCoach/1.0 (educacionxunfuturo@gmail.com)";
const CACHE_TTL_HOURS = 168; // 7 days

const QID_MAP: Record<string, string> = {
  fischer: "Q855",
  tal: "Q9492",
  capablanca: "Q200726",
  carlsen: "Q81498",
  kasparov: "Q892",
};

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WDQS_ENDPOINT = "https://query.wikidata.org/sparql";

function extractTimeClaim(entity: any, prop: string): string | null {
  const claims = entity?.claims?.[prop];
  if (!claims?.length) return null;
  const time = claims[0]?.mainsnak?.datavalue?.value?.time;
  if (!time || typeof time !== "string") return null;
  const match = time.match(/^[+-](\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function extractImage(entity: any): string | null {
  const claims = entity?.claims?.P18;
  if (!claims?.length) return null;
  const val = claims[0]?.mainsnak?.datavalue?.value;
  return typeof val === "string" ? val : null;
}

function pickWikiTitle(entity: any, lang: string): string | null {
  const sitelinks = entity?.sitelinks || {};
  const key = `${lang}wiki`;
  if (sitelinks[key]?.title) return sitelinks[key].title;
  if (sitelinks.enwiki?.title) return sitelinks.enwiki.title;
  return null;
}

async function fetchEntity(qid: string, lang: string): Promise<any | null> {
  const url = `${WIKIDATA_API}?action=wbgetentities&ids=${qid}&props=labels|descriptions|claims|sitelinks&languages=${lang}|en&format=json`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.entities?.[qid] || null;
}

async function fetchWikipediaExtract(title: string, lang: string): Promise<string | null> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const params = new URLSearchParams({
    action: "query", prop: "extracts", exintro: "1", explaintext: "1",
    titles: title, format: "json", redirects: "1",
  });
  const res = await fetch(`${api}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0] as any;
  const extract = page?.extract;
  return typeof extract === "string" && extract.trim() ? extract.trim() : null;
}

async function fetchChampionTerms(qid: string): Promise<any> {
  const query = `SELECT ?start ?end WHERE {
  wd:${qid} p:P39 ?statement .
  ?statement ps:P39 wd:Q10873124 .
  OPTIONAL { ?statement pq:P580 ?start . }
  OPTIONAL { ?statement pq:P582 ?end . }
} ORDER BY ?start`;

  const res = await fetch(`${WDQS_ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) return { world_champion_terms: [] };
  const data = await res.json();
  const bindings = data?.results?.bindings || [];
  return {
    world_champion_terms: bindings.map((b: any) => ({
      start: b.start?.value || null,
      end: b.end?.value || null,
    })),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { coach_id, lang = "es" } = await req.json();
    if (!coach_id) {
      return new Response(JSON.stringify({ error: "coach_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qid = QID_MAP[coach_id];
    if (!qid) {
      return new Response(JSON.stringify({ error: "Unknown coach" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache
    const { data: cached } = await supabase
      .from("wiki_entity_cache")
      .select("*")
      .eq("coach_id", coach_id)
      .eq("lang", lang)
      .maybeSingle();

    if (cached?.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_HOURS * 3600 * 1000) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch from Wikidata
    const entity = await fetchEntity(qid, lang);
    if (!entity) {
      if (cached) return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      return new Response(JSON.stringify({ error: "Failed to fetch from Wikidata" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const label = entity.labels?.[lang]?.value || entity.labels?.en?.value || "";
    const description = entity.descriptions?.[lang]?.value || entity.descriptions?.en?.value || "";
    const wikiTitle = pickWikiTitle(entity, lang);
    const summary = wikiTitle ? await fetchWikipediaExtract(wikiTitle, lang) : null;
    const birthDate = extractTimeClaim(entity, "P569");
    const deathDate = extractTimeClaim(entity, "P570");
    const image = extractImage(entity);
    const extra = await fetchChampionTerms(qid);

    const row = {
      coach_id, lang, qid, label, description,
      wikipedia_title: wikiTitle,
      wikipedia_summary: summary,
      birth_date: birthDate,
      death_date: deathDate,
      image,
      wikidata_json: entity,
      extra_json: extra,
      fetched_at: new Date().toISOString(),
    };

    // Upsert cache
    await supabase.from("wiki_entity_cache").upsert(row, { onConflict: "coach_id,lang" });

    return new Response(JSON.stringify(row), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wiki-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
