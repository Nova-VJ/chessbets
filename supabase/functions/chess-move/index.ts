import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PERSONA_STYLES: Record<string, string> = {
  fischer: `You are a chess engine playing as Bobby Fischer. Choose aggressive, precise moves. Favor king-side attacks, open positions, and concrete tactical lines. Prefer the Ruy Lopez, Sicilian Najdorf (as black). Play at ~2750 ELO strength.`,
  tal: `You are a chess engine playing as Mikhail Tal. Choose the most aggressive, sacrificial move available. Prefer complications, piece sacrifices for initiative, and speculative attacks even if not fully sound. Play at ~2700 ELO with a bias toward chaos.`,
  capablanca: `You are a chess engine playing as Jose Raul Capablanca. Choose the simplest, most positionally sound move. Favor exchanges that lead to favorable endgames, avoid unnecessary complications, and maintain pawn structure integrity. Play at ~2700 ELO.`,
  carlsen: `You are a chess engine playing as Magnus Carlsen. Choose pragmatic moves that maintain slight advantages and require the opponent to find precise responses. Avoid forced draws, prefer grinding positions. Play at ~2850 ELO.`,
  kasparov: `You are a chess engine playing as Garry Kasparov. Choose dynamic, energetic moves with strong initiative. Favor deep preparation lines, central control, and powerful piece activity. Play at ~2800 ELO.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fen, persona, time_control } = await req.json();
    if (!fen || !persona) {
      return new Response(JSON.stringify({ error: "fen and persona required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = PERSONA_STYLES[persona] || PERSONA_STYLES.fischer;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Current position (FEN): ${fen}\nTime control: ${time_control || 10} minutes.\n\nAnalyze this position and choose your next move. You MUST respond with ONLY a JSON object in this exact format: {"move": "e2e4", "san": "e4"}\nThe "move" field must be in UCI format (source square + destination square, e.g. e2e4, g1f3, e7e8q for promotion).\nThe "san" field must be the standard algebraic notation.\nDo NOT include any other text, explanation, or markdown. Just the raw JSON object.` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    // Parse the move from AI response
    let move = "";
    let san = "";
    try {
      // Try to parse as JSON first
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      move = parsed.move || "";
      san = parsed.san || "";
    } catch {
      // Fallback: extract UCI move pattern from text
      const uciMatch = content.match(/\b([a-h][1-8][a-h][1-8][qrbnQRBN]?)\b/);
      if (uciMatch) {
        move = uciMatch[1];
        san = move; // approximate
      }
    }

    if (!move || !/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(move)) {
      console.error("Invalid move from AI:", content);
      return new Response(JSON.stringify({ error: "AI returned invalid move", raw: content }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ move, san }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chess-move error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
