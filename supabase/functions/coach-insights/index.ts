import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, coach_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all games
    let gamesQuery = supabase
      .from("coach_game_history")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true });
    if (coach_id) gamesQuery = gamesQuery.eq("coach_id", coach_id);

    // Fetch memory profiles
    let memQuery = supabase
      .from("coach_memory_profiles")
      .select("*")
      .eq("user_id", user_id);
    if (coach_id) memQuery = memQuery.eq("coach_id", coach_id);

    const [gamesResult, memResult] = await Promise.all([gamesQuery, memQuery]);
    const games = gamesResult.data || [];
    const memories = memResult.data || [];

    // Compute insights
    const totalGames = games.length;
    const wins = games.filter((g: any) => g.result === '1-0' || g.result === 'win').length;
    const losses = games.filter((g: any) => g.result === '0-1' || g.result === 'loss').length;
    const draws = games.filter((g: any) => g.result === '1/2-1/2' || g.result === 'draw').length;

    // Opening distribution
    const openingCounts: Record<string, number> = {};
    games.forEach((g: any) => {
      const op = g.opening || 'Unknown';
      openingCounts[op] = (openingCounts[op] || 0) + 1;
    });
    const topOpenings = Object.entries(openingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Rating progression
    const ratingHistory = games
      .filter((g: any) => g.rating != null)
      .map((g: any) => ({ date: g.created_at, rating: g.rating, coach_id: g.coach_id }));

    // Per-coach stats
    const coachStats: Record<string, any> = {};
    games.forEach((g: any) => {
      if (!coachStats[g.coach_id]) {
        coachStats[g.coach_id] = { games: 0, wins: 0, losses: 0, draws: 0 };
      }
      coachStats[g.coach_id].games++;
      if (g.result === '1-0' || g.result === 'win') coachStats[g.coach_id].wins++;
      else if (g.result === '0-1' || g.result === 'loss') coachStats[g.coach_id].losses++;
      else coachStats[g.coach_id].draws++;
    });

    return new Response(JSON.stringify({
      total_games: totalGames,
      wins, losses, draws,
      win_rate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
      top_openings: topOpenings,
      rating_history: ratingHistory,
      coach_stats: coachStats,
      memory_profiles: memories,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
