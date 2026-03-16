import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COACH_META: Record<string, any> = {
  fischer: {
    full_name: "Robert James Fischer",
    nickname: "Bobby Fischer",
    country: "US",
    peak_elo: 2785,
    world_champion: "1972-1975",
    style: "Agresivo, preciso, táctico",
    books: ["My 60 Memorable Games", "Bobby Fischer Teaches Chess", "Bobby Fischer's Games of Chess"],
    avatar: "/coaches/fischer_avatar.png",
    wikidata_qid: "Q41871",
  },
  tal: {
    full_name: "Mikhail Nekhemyevich Tal",
    nickname: "El Mago de Riga",
    country: "LV",
    peak_elo: 2705,
    world_champion: "1960-1961",
    style: "Sacrificial, creativo, caótico",
    books: ["The Life and Games of Mikhail Tal", "Tal-Botvinnik 1960"],
    avatar: "/coaches/tal_avatar.png",
    wikidata_qid: "Q43845",
  },
  capablanca: {
    full_name: "José Raúl Capablanca y Graupera",
    nickname: "La Máquina Humana",
    country: "CU",
    peak_elo: 2725,
    world_champion: "1921-1927",
    style: "Posicional, técnico, elegante",
    books: ["Chess Fundamentals", "A Primer of Chess", "My Chess Career"],
    avatar: "/coaches/capablanca_avatar.png",
    wikidata_qid: "Q180685",
  },
  carlsen: {
    full_name: "Sven Magnus Øen Carlsen",
    nickname: "Magnus",
    country: "NO",
    peak_elo: 2882,
    world_champion: "2013-2023",
    style: "Universal, técnico, implacable en finales",
    books: ["Endgame Virtuoso Magnus Carlsen", "Attack with Magnus Carlsen"],
    avatar: "/coaches/carlsen_avatar.png",
    wikidata_qid: "Q4263",
  },
  kasparov: {
    full_name: "Garry Kimovich Kasparov",
    nickname: "La Bestia de Bakú",
    country: "RU",
    peak_elo: 2851,
    world_champion: "1985-2000",
    style: "Dinámico, enérgico, preparación profunda",
    books: ["My Great Predecessors", "How Life Imitates Chess"],
    avatar: "/coaches/kasparov_avatar.png",
    wikidata_qid: "Q41583",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { coach_id, lang } = await req.json();
    if (!coach_id) {
      return new Response(JSON.stringify({ error: "coach_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = COACH_META[coach_id];
    if (!meta) {
      return new Response(JSON.stringify({ error: "Unknown coach" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get wiki cache
    const { data: wiki } = await supabase
      .from("wiki_entity_cache")
      .select("*")
      .eq("coach_id", coach_id)
      .eq("lang", lang || "es")
      .maybeSingle();

    // Get analytics from game history
    const { data: games } = await supabase
      .from("coach_game_history")
      .select("result, user_color, opening, rating")
      .eq("coach_id", coach_id);

    const totalGames = (games || []).length;
    const coachWins = (games || []).filter((g: any) => {
      if (g.user_color === 'w') return g.result === '0-1' || g.result === 'loss';
      return g.result === '1-0' || g.result === 'win';
    }).length;

    return new Response(JSON.stringify({
      ...meta,
      coach_id,
      biography: wiki?.wikipedia_summary || null,
      birth_date: wiki?.birth_date || null,
      death_date: wiki?.death_date || null,
      image: wiki?.image || meta.avatar,
      extra: wiki?.extra_json || {},
      analytics: {
        total_games_played_by_users: totalGames,
        coach_win_rate: totalGames > 0 ? Math.round((coachWins / totalGames) * 100) : 0,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-master-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
