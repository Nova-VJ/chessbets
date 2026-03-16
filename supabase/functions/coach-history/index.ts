import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, coach_id, limit, session_token } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch game history
    let gameQuery = supabase
      .from("coach_game_history")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });
    
    if (coach_id) gameQuery = gameQuery.eq("coach_id", coach_id);
    if (limit) gameQuery = gameQuery.limit(limit);

    // Fetch conversation sessions
    let convQuery = supabase
      .from("coach_conversations")
      .select("session_token, coach_id, created_at, interaction_mode")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });
    
    if (coach_id) convQuery = convQuery.eq("coach_id", coach_id);

    // Fetch specific session if token provided
    let sessionMessages = null;
    if (session_token) {
      const { data } = await supabase
        .from("coach_conversations")
        .select("*")
        .eq("user_id", user_id)
        .eq("session_token", session_token)
        .order("created_at", { ascending: true });
      sessionMessages = data;
    }

    const [gameResult, convResult] = await Promise.all([gameQuery, convQuery]);

    // Deduplicate sessions
    const sessionMap = new Map();
    (convResult.data || []).forEach((c: any) => {
      if (!sessionMap.has(c.session_token)) {
        sessionMap.set(c.session_token, {
          session_token: c.session_token,
          coach_id: c.coach_id,
          started_at: c.created_at,
          interaction_mode: c.interaction_mode,
        });
      }
    });

    return new Response(JSON.stringify({
      games: gameResult.data || [],
      sessions: Array.from(sessionMap.values()),
      session_messages: sessionMessages,
      total_games: (gameResult.data || []).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-history error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
