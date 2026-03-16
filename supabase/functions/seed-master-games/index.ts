import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Master name mappings for Lichess Masters DB API
const MASTERS: Record<string, { lichessName: string; coachId: string }> = {
  fischer:    { lichessName: "Fischer,Robert+James",   coachId: "fischer" },
  tal:        { lichessName: "Tal,Mihail",             coachId: "tal" },
  capablanca: { lichessName: "Capablanca,Jose+Raul",   coachId: "capablanca" },
  kasparov:   { lichessName: "Kasparov,Garry",         coachId: "kasparov" },
  carlsen:    { lichessName: "Carlsen,Magnus",         coachId: "carlsen" },
};

// Fetch games from Lichess Masters Database API
async function fetchMasterGames(playerName: string, coachId: string): Promise<any[]> {
  const games: any[] = [];
  const baseUrl = "https://explorer.lichess.ovh/masters";

  // Fetch top games across multiple openings by iterating popular first moves
  const firstMoves = [
    "e2e4", "d2d4", "c2c4", "g1f3", // as white
  ];

  // Also fetch games where master plays as black (no fen filter → default starting position)
  const urls: string[] = [];

  // Default position — gets top games where this player appears
  urls.push(`${baseUrl}?player=${playerName}&recentGames=15&topGames=15`);

  // With common first moves for more variety
  for (const move of firstMoves) {
    urls.push(`${baseUrl}?player=${playerName}&play=${move}&recentGames=10&topGames=10`);
    // Second-level depth for more games
    const secondMoves = move === "e2e4" ? ["e7e5", "c7c5", "e7e6", "c7c6", "d7d5", "g7g6"]
      : move === "d2d4" ? ["d7d5", "g8f6", "e7e6", "f7f5"]
      : move === "c2c4" ? ["e7e5", "g8f6", "c7c5"]
      : ["d7d5", "g8f6"];
    for (const sm of secondMoves) {
      urls.push(`${baseUrl}?player=${playerName}&play=${move},${sm}&recentGames=5&topGames=5`);
    }
  }

  const seenIds = new Set<string>();

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: { "Accept": "application/json" },
      });
      if (!resp.ok) {
        console.warn(`Lichess API ${resp.status} for ${url}`);
        continue;
      }
      const data = await resp.json();

      // topGames and recentGames contain actual game references
      const allGames = [...(data.topGames || []), ...(data.recentGames || [])];

      for (const g of allGames) {
        const id = g.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        games.push({
          white: g.white?.name || "Unknown",
          black: g.black?.name || "Unknown",
          result: g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "1/2-1/2",
          opening: data.opening?.name || null,
          eco: data.opening?.eco || null,
          event: g.month ? `OTB ${g.month}` : "OTB Masters",
          date: g.month || null,
          coach_id: coachId,
          pgn: null, // Lichess explorer doesn't return full PGN in this endpoint
          fen_list: [],
        });
      }

      // Rate limit: be gentle with the free API
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.warn(`Error fetching ${url}:`, e);
    }

    // Stop early if we have enough
    if (games.length >= 250) break;
  }

  return games;
}

// Fetch full PGN for individual games from Lichess game export
async function enrichWithPGN(games: any[]): Promise<any[]> {
  // The explorer API games have IDs that can be fetched from lichess.org
  // But for masters DB games, the IDs are internal. We'll fetch PGNs where possible.
  for (const game of games.slice(0, 50)) {
    // Try to get PGN from lichess game endpoint if ID looks like a lichess game ID
    // Masters DB uses short IDs
    try {
      const resp = await fetch(`https://lichess.org/game/export/${game._lichessId || ""}?pgnInJson=true`, {
        headers: { "Accept": "application/json" },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.pgn) game.pgn = data.pgn;
      }
    } catch { /* ignore */ }
  }
  return games;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, number> = {};
    let totalInserted = 0;

    for (const [key, master] of Object.entries(MASTERS)) {
      // Check existing count
      const { count } = await supabase
        .from("master_games")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", master.coachId);

      if ((count || 0) >= 200) {
        results[key] = count || 0;
        console.log(`${key} already has ${count} games, skipping.`);
        continue;
      }

      console.log(`Fetching games for ${key} (${master.lichessName})...`);
      const games = await fetchMasterGames(master.lichessName, master.coachId);
      console.log(`Found ${games.length} games for ${key}`);

      if (games.length > 0) {
        // Insert in batches of 50
        for (let i = 0; i < games.length; i += 50) {
          const batch = games.slice(i, i + 50).map(g => ({
            white: g.white,
            black: g.black,
            result: g.result,
            opening: g.opening,
            eco: g.eco,
            event: g.event,
            date: g.date,
            coach_id: g.coach_id,
            pgn: g.pgn,
            fen_list: g.fen_list || [],
          }));

          const { error } = await supabase.from("master_games").insert(batch);
          if (error) {
            console.error(`Insert error for ${key} batch ${i}:`, error);
          }
        }
        totalInserted += games.length;
      }

      results[key] = (count || 0) + games.length;
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Seeded ${totalInserted} new master games`,
      counts: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-master-games error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
