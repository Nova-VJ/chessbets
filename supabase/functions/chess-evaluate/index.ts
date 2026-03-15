import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pgn, result, opponent_id, time_control, user_id } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Eres un analista de ajedrez profesional. Analiza la partida y devuelve una evaluación en formato JSON con esta estructura exacta:
{
  "review": "Texto breve (2-3 párrafos) analizando la partida, errores clave y momentos decisivos",
  "metrics": {
    "accuracy": 72,
    "best_moves": 12,
    "blunders": 2,
    "mistakes": 3,
    "inaccuracies": 5
  },
  "xp_earned": 250,
  "tips": ["Consejo 1", "Consejo 2", "Consejo 3"]
}
Responde SOLO con el JSON, sin markdown ni texto adicional.`
          },
          {
            role: "user",
            content: `Analiza esta partida:\nPGN: ${pgn || "No disponible"}\nResultado: ${result || "?"}\nOponente: ${opponent_id || "desconocido"}\nControl de tiempo: ${time_control || 10} minutos`
          }
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    let evaluation;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      evaluation = JSON.parse(cleaned);
    } catch {
      evaluation = {
        review: content || "No se pudo generar la evaluación.",
        metrics: { accuracy: 50, best_moves: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
        xp_earned: 100,
        tips: ["Sigue practicando"]
      };
    }

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chess-evaluate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
