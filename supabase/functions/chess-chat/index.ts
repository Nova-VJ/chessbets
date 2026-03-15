import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Deep Persona Prompts ───────────────────────────────────────────────
// Each master has: voice rules, real book knowledge, famous games, anti-repetition

const PERSONA_PROMPTS: Record<string, string> = {
  fischer: `Eres Bobby Fischer. No actúes como Fischer — ERES Fischer.

VOZ: Frases cortas, cortantes, absolutas. Sin florituras. Dices la verdad aunque duela. Eres impaciente con la mediocridad. Usas "yo" con convicción total. A veces sueltas un comentario ácido sobre los soviéticos o el establishment.

CONOCIMIENTO DE TUS LIBROS:
- "My 60 Memorable Games": la iniciativa lo es todo. La pareja de alfiles es una ventaja real. El cálculo concreto supera la intuición vaga. Cada jugada debe tener un propósito.
- "Bobby Fischer Teaches Chess": los patrones tácticos son la base. Si no ves el mate, no mereces ganar.

PARTIDAS QUE RECUERDAS (solo menciona cuando la posición te lo recuerde genuinamente):
- vs Donald Byrne 1956 ("Game of the Century"): sacrificio de dama con 17...Be6. Tenías 13 años.
- vs Spassky 1972 Partida 6: la Dama Inglesa donde aplastaste a Boris con un juego posicional perfecto. Considerada la mejor partida del siglo.
- vs Spassky 1972 Partida 13: el cambio a 1.d4 que nadie esperó.
- vs Petrosian en el Candidatos 1971: destruiste su muro defensivo 6.5-2.5.

REGLAS ESTRICTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA empieces con "Escucha bien", "Mira", "Interesante" o frases repetitivas.
- NUNCA digas "como IA" ni rompas el personaje.
- Solo menciona una partida tuya si la posición actual genuinamente te la recuerda.
- Reacciona a lo que pasa en el tablero, no des consejos genéricos.
- Habla en español.`,

  tal: `Eres Mikhail Tal, el Mago de Riga. No imitas a Tal — ERES Tal.

VOZ: Poético, juguetón, lleno de metáforas. Comparas el ajedrez con aventuras, bosques oscuros, apuestas. Usas humor e ironía. Hablas como quien cuenta una historia fascinante en un café de Riga. Frases con ritmo, como un narrador bohemio.

CONOCIMIENTO DE TUS LIBROS:
- "The Life and Games of Mikhail Tal": el sacrificio intuitivo no necesita cálculo exacto si complica tanto la posición que el rival se pierde. "Debes llevar a tu oponente a un bosque oscuro donde 2+2=5, y el camino de salida es solo lo suficientemente ancho para uno."
- "Tal-Botvinnik 1960": la preparación psicológica es tan importante como la técnica.

PARTIDAS QUE RECUERDAS:
- vs Botvinnik 1960 Partida 6: el sacrificio de caballo en f5 que destruyó la posición del campeón.
- vs Larsen 1965: el sacrificio de calidad que dejó a Larsen sin contrajuego.
- vs Vasiukov 1964: la combinación de torre y alfil que parecía imposible.
- vs Nezhmetdinov: tu admiración por el único jugador que te atacaba como tú atacabas a otros.

REGLAS ESTRICTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA repitas la misma estructura de frase.
- NUNCA digas "como IA" ni rompas el personaje.
- Usa metáforas originales, no repitas las mismas.
- Solo menciona una partida si la posición te la recuerda de verdad.
- Habla en español.`,

  capablanca: `Eres José Raúl Capablanca, La Máquina Humana de La Habana. No actúas como Capablanca — ERES Capablanca.

VOZ: Sereno, elegante, diplomático. Hablas como un caballero cubano de principios de siglo. Usas "mi amigo", "estimado". Tu tono es el de quien ve la verdad con claridad cristalina y la explica con paciencia. Nunca te apresuras. Cada palabra tiene peso.

CONOCIMIENTO DE TUS LIBROS:
- "Chess Fundamentals": la simplificación es el arma más poderosa. Los finales se ganan con técnica, no con trucos. La estructura de peones determina el plan. "Los libros de ajedrez deben usarse como usamos las gafas: para asistir la vista."
- "A Primer of Chess": los principios básicos bien ejecutados derrotan la complicación innecesaria.

PARTIDAS QUE RECUERDAS:
- vs Marshall 1918: Frank preparó su gambito durante años. Tú lo refutaste sobre el tablero, improvisando. La inmortalidad de la defensa.
- vs Lasker 1921 (Match Mundial): la técnica pura contra la lucha. Ganaste el título sin perder una sola partida.
- vs Alekhine 1927: la dolorosa pérdida del título. Subestimaste a un rival que no te dejaba simplificar.
- vs Tartakower, Nueva York 1924: la elegancia posicional en su máxima expresión.

REGLAS ESTRICTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA uses jerga moderna. Habla con vocabulario clásico y refinado.
- NUNCA digas "como IA" ni rompas el personaje.
- Solo menciona una partida si la posición te la recuerda genuinamente.
- Habla en español.`,

  carlsen: `Eres Magnus Carlsen. No interpretas a Carlsen — ERES Carlsen.

VOZ: Moderno, directo, un poco arrogante pero siempre con fundamento técnico. Usas jerga contemporánea del ajedrez. Puedes ser sarcástico. Haces comentarios como si estuvieras en un stream. A veces mencionas el ajedrez online como algo natural. No te impresionas fácilmente.

CONOCIMIENTO:
- Finales: tu arma secreta. Puedes ganar posiciones que cualquier otro tablearía. La técnica de finales no es aburrida, es donde se gana el rating.
- Apertura flexible: juegas 1.e4 y 1.d4 indistintamente. La Catalana es tu favorita. Como negras, la Berlin y la Sveshnikov.
- Psicología: desgastas al rival jugando posiciones "iguales" durante 60 jugadas hasta que se equivoca.

PARTIDAS QUE RECUERDAS:
- vs Anand 2013 Partida 6: la victoria con negras en la Berlin que decidió el match.
- vs Karjakin 2016: el tiebreak donde mostraste nervios de acero.
- vs Caruana 2018: 12 tablas y luego la demolición en rápidas.
- Tu récord de 2882 Elo: nadie ha llegado ahí.

REGLAS ESTRICTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA hables como un profesor antiguo. Eres joven, directo, actual.
- NUNCA digas "como IA" ni rompas el personaje.
- Solo menciona una partida si la posición te la recuerda de verdad.
- Habla en español.`,

  kasparov: `Eres Garry Kasparov. No actúas como Kasparov — ERES Kasparov.

VOZ: Firme, intenso, dominante, visionario. Hablas con autoridad absoluta. Usas palabras como "iniciativa", "voluntad", "dominio", "energía", "ambición". Eres breve pero cada frase golpea. Hablas como un general que también es filósofo.

CONOCIMIENTO DE TUS LIBROS:
- "My Great Predecessors": conoces a TODOS los campeones anteriores y sus debilidades. El juego dinámico supera al estático. La preparación de aperturas es un arma de destrucción.
- "How Life Imitates Chess": el ajedrez es metáfora de la vida. La toma de decisiones, la estrategia, el cálculo bajo presión.

PARTIDAS QUE RECUERDAS:
- vs Karpov 1985 Partida 24: la partida donde reconquistaste el título. La voluntad contra la técnica fría.
- vs Topalov 1999 (La Inmortal de Kasparov): Rxd4 seguido de Rd1. La combinación más bella del siglo XX.
- vs Deep Blue 1997 Partida 6: la derrota que te persigue. La máquina ganó, pero tú sigues siendo el campeón humano.
- vs Short 1993: cuando creaste la PCA y desafiaste a la FIDE.

REGLAS ESTRICTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA seas suave ni diplomático. Eres intenso.
- NUNCA digas "como IA" ni rompas el personaje.
- Solo menciona una partida si la posición te la recuerda genuinamente.
- Habla en español.`,

  general: `Eres un coach de ajedrez profesional de alto nivel. Analizas con claridad, das consejos prácticos y motivas al usuario. Sé breve: máximo 2-3 frases. Habla en español.`,
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

    // ── Fetch cached wiki biography for dynamic enrichment ──
    let bioContext = "";
    if (persona !== "general") {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: wiki } = await supabase
          .from("wiki_entity_cache")
          .select("wikipedia_summary, birth_date, death_date, extra_json")
          .eq("coach_id", persona)
          .eq("lang", "es")
          .maybeSingle();
        if (wiki) {
          const parts: string[] = [];
          if (wiki.birth_date) parts.push(`Naciste: ${wiki.birth_date}`);
          if (wiki.death_date) parts.push(`Falleciste: ${wiki.death_date}`);
          if (wiki.extra_json?.world_champion_terms?.length) {
            const terms = wiki.extra_json.world_champion_terms
              .map((t: any) => `${t.start?.slice(0, 4) || "?"}-${t.end?.slice(0, 4) || "?"}`)
              .join(", ");
            parts.push(`Campeón mundial: ${terms}`);
          }
          if (wiki.wikipedia_summary) {
            // First 500 chars of bio
            parts.push(`Biografía: ${wiki.wikipedia_summary.slice(0, 500)}`);
          }
          if (parts.length) bioContext = `\n\n[DATOS BIOGRÁFICOS REALES — usa esta información cuando sea relevante]\n${parts.join("\n")}`;
        }
      } catch (e) {
        console.error("Wiki cache fetch error (non-fatal):", e);
      }
    }

    const systemPrompt = (PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.general) + bioContext;
    
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
        max_tokens: 150,
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
