import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pgn, result, opponent_id, time_control, user_id, session_token } = await req.json();

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
  "tips": ["Consejo 1", "Consejo 2", "Consejo 3"],
  "strengths": ["Fortaleza detectada 1", "Fortaleza detectada 2"],
  "weaknesses": ["Debilidad detectada 1", "Debilidad detectada 2"]
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

    let evaluation: any;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      evaluation = JSON.parse(cleaned);
    } catch {
      evaluation = {
        review: content || "No se pudo generar la evaluación.",
        metrics: { accuracy: 50, best_moves: 0, blunders: 0, mistakes: 0, inaccuracies: 0 },
        xp_earned: 100,
        tips: ["Sigue practicando"],
        strengths: [],
        weaknesses: [],
      };
    }

    // ── Persist to coach_memory_profiles if user_id provided ──
    if (user_id && (evaluation.strengths?.length || evaluation.weaknesses?.length)) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const coachId = opponent_id || "general";

        // Fetch existing profile
        const { data: existing } = await supabase
          .from("coach_memory_profiles")
          .select("id, strengths_json, weaknesses_json")
          .eq("user_id", user_id)
          .eq("coach_id", coachId)
          .maybeSingle();

        const mergeUnique = (existing: string[] | null, incoming: string[]) => {
          const set = new Set([...(existing || []), ...incoming]);
          return [...set].slice(0, 20); // cap at 20
        };

        const newStrengths = mergeUnique(existing?.strengths_json as any, evaluation.strengths || []);
        const newWeaknesses = mergeUnique(existing?.weaknesses_json as any, evaluation.weaknesses || []);

        if (existing) {
          await supabase
            .from("coach_memory_profiles")
            .update({
              strengths_json: newStrengths,
              weaknesses_json: newWeaknesses,
              last_topic: `Evaluación: ${result || "?"}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("coach_memory_profiles")
            .insert({
              user_id,
              coach_id: coachId,
              strengths_json: newStrengths,
              weaknesses_json: newWeaknesses,
              last_topic: `Evaluación: ${result || "?"}`,
            });
        }

        // Update XP on profile
        if (evaluation.xp_earned) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("xp, level")
            .eq("id", user_id)
            .single();
          if (prof) {
            const newXp = (prof.xp || 0) + evaluation.xp_earned;
            const newLevel = Math.floor(newXp / 1000) + 1;
            await supabase
              .from("profiles")
              .update({ xp: newXp, level: newLevel })
              .eq("id", user_id);
          }
        }
      } catch (e) {
        console.error("Memory profile upsert error (non-fatal):", e);
      }
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
