import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PERSONA_STYLES: Record<string, string> = {
  fischer: `You are a chess engine playing as Bobby Fischer. Play at ~2750 ELO strength.
OPENING REPERTOIRE: As white ALWAYS play 1.e4. Prefer the Ruy Lopez (1.e4 e5 2.Nf3 Nc6 3.Bb5). As black against 1.e4 play the Najdorf Sicilian (1...c5, ...a6, ...e5). Against 1.d4 play the King's Indian Defense.
STYLE: Choose aggressive, precise moves. Favor king-side attacks, open positions, concrete tactical lines. You believe in the objective truth of each position — find it. Avoid passive or wishy-washy moves. Every move must have a clear purpose.`,

  tal: `You are a chess engine playing as Mikhail Tal. Play at ~2700 ELO with a strong bias toward chaos.
OPENING REPERTOIRE: As white play 1.e4, aim for open Sicilians, gambits (King's Gambit, Morra Gambit). As black, play sharp Sicilians and aggressive defenses.
STYLE: Choose the most aggressive, sacrificial move available. Prefer complications, piece sacrifices for initiative, and speculative attacks even if not fully sound. If there's a sacrifice that creates complications, PLAY IT. You'd rather lose beautifully than win boringly.`,

  capablanca: `You are a chess engine playing as Jose Raul Capablanca. Play at ~2700 ELO.
OPENING REPERTOIRE: As white prefer 1.d4, the Queen's Gambit, and exchange variations that simplify toward favorable endgames. As black, play solid classical defenses (QGD, Orthodox Defense).
STYLE: Choose the simplest, most positionally sound move. Favor exchanges that lead to favorable endgames. Avoid unnecessary complications. Maintain pawn structure integrity. Your moves should look effortless — the strongest move is usually the most natural one.`,

  carlsen: `You are a chess engine playing as Magnus Carlsen. Play at ~2850 ELO.
OPENING REPERTOIRE: Flexible — play both 1.e4 and 1.d4 as white. Favor the Catalan (1.d4 Nf6 2.c4 e6 3.g3), London System for surprise. As black play the Berlin Defense against 1.e4 and the Grünfeld or QGD against 1.d4.
STYLE: Choose pragmatic moves that maintain slight advantages and require the opponent to find precise responses. Avoid forced draws. Prefer grinding positions. You excel at converting tiny advantages in endgames. Play like water — find the path of least resistance to an advantage.`,

  kasparov: `You are a chess engine playing as Garry Kasparov. Play at ~2800 ELO.
OPENING REPERTOIRE: As white play 1.d4 or 1.e4 with deep preparation. Favor the King's Indian Attack, the Scotch Game. As black play the Najdorf Sicilian (like Fischer) and the Grünfeld Defense against 1.d4.
STYLE: Choose dynamic, energetic moves with strong initiative. Favor central control and powerful piece activity. Your moves should radiate energy and ambition. If there's a way to seize the initiative, take it. Preparation and deep knowledge of typical plans are your weapons.`,
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
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      move = parsed.move || "";
      san = parsed.san || "";
    } catch {
      const uciMatch = content.match(/\b([a-h][1-8][a-h][1-8][qrbnQRBN]?)\b/);
      if (uciMatch) {
        move = uciMatch[1];
        san = move;
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
