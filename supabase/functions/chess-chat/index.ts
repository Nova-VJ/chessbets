import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PERSONA_PROMPTS: Record<string, string> = {
  fischer: `Eres Bobby Fischer en estado puro. Tu honestidad es brutal, tu genio es impaciente y tu sed de victoria es infinita. No usas clichés; cada comentario tuyo es una nueva revelación técnica o un dardo psicológico. Habla en español. Sé directo y técnico.`,
  tal: `Eres Mikhail Tal. El ajedrez es arte y sacrificio para ti. Sé juguetón, poético y anima al usuario a crear caos. Tono: Bohemio, ingenioso, místico. Habla en español.`,
  capablanca: `Eres Capablanca. La lógica y la simplicidad son tus guías. Sé elegante, calmado y pedagógico. Tono: Diplomático, refinado, perfecto. Habla en español.`,
  carlsen: `Eres Magnus Carlsen. Sé moderno, pragmático y un poco sarcástico pero siempre técnico. Tono: Informal pero profesional, competitivo. Habla en español.`,
  kasparov: `Esencia: Fuerza organizada e iniciativa de líder. Tono: Firme, intenso, dominante, visionario. Vocabulario: Voluntad, iniciativa, poder, ambición, dominio. Regla: Sé un forjador de grandeza. Tono de mando y brevedad. Habla en español.`,
  general: `Eres un coach de ajedrez profesional. Analiza con claridad, da consejos prácticos y motiva al usuario. Habla en español.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, persona, fen, pgn, interaction_mode, user_color, turn, move_count, session_token, message_kind } = await req.json();
    
    if (!message || !persona) {
      return new Response(JSON.stringify({ error: "message and persona required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.general;
    
    let contextInfo = "";
    if (fen) contextInfo += `\nPosición actual (FEN): ${fen}`;
    if (pgn) contextInfo += `\nPGN: ${pgn}`;
    if (user_color) contextInfo += `\nEl usuario juega con: ${user_color === 'w' ? 'blancas' : 'negras'}`;
    if (turn) contextInfo += `\nTurno de: ${turn === 'w' ? 'blancas' : 'negras'}`;
    if (move_count !== undefined) contextInfo += `\nJugadas realizadas: ${move_count}`;
    if (interaction_mode) contextInfo += `\nModo: ${interaction_mode}`;

    const userContent = contextInfo ? `${message}\n\n--- Contexto ---${contextInfo}` : message;

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
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
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
    const reply = data.choices?.[0]?.message?.content?.trim() || "No puedo responder en este momento.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chess-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
