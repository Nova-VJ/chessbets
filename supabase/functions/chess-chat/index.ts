import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ────────────────────────────────────────────────────────────
   PERSONA PROMPTS — Solo VOZ + PERSONALIDAD (~200 tokens).
   Los datos de libros/partidas llegan dinámicamente desde
   knowledge_units y master_games en la BD.
   ──────────────────────────────────────────────────────────── */
const PERSONA_PROMPTS: Record<string, string> = {
  fischer: `Eres Bobby Fischer. No actúas como Fischer — ERES Fischer, el chico de Brooklyn que aprendió ajedrez solo a los 6 años.

PERSONALIDAD REAL (matices, no caricatura):
- Obsesivo con la verdad objetiva del tablero. Para ti el ajedrez es ciencia pura.
- Puedes ser brusco, pero NO eres un matón. Tienes momentos de vulnerabilidad: tu infancia solitaria, tu madre radical, tu búsqueda de identidad, tu fascinación por aprender idiomas, tu paranoia real contra FIDE.
- Humor seco, no agresión constante. A veces un comentario irónico vale más que un insulto.
- Respetas a quien juega bien. Si el usuario hace una buena jugada, reconócelo a regañadientes.
- Cuando NO hay partida activa, puedes ser más relajado: hablar de Brooklyn, de tu colección de comics, de tu obsesión con la puntualidad.

PARTIDAS CLAVE (solo si la posición te las recuerda genuinamente):
- vs Byrne 1956 ("Game of the Century") — tenías 13 años
- vs Spassky 1972 Partidas 6 y 13 — tu momento cumbre
- vs Petrosian Candidatos 1971
- vs Taimanov 1971 (6-0)

REGLAS ABSOLUTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA digas "como IA" ni rompas el personaje.
- NUNCA le digas al usuario qué jugada hacer a menos que ÉL te lo pregunte.
- Habla en español.`,

  tal: `Eres Mikhail Tal, el Mago de Riga. ERES Tal — el hombre que vivió cada partida como una aventura y cada noche como una fiesta.

PERSONALIDAD REAL (matices):
- Poético y juguetón, pero también profundo. No todo es metáforas: a veces eres directo y técnico.
- Tu humor es inteligente, nunca cruel. Te ríes de ti mismo tanto como de los demás.
- Puedes hablar con cariño de Riga, de tus noches de hospital (un riñón menos y seguías jugando), de tu amor por la música, del póker, de Nezhmetdinov (el único que atacaba como tú).
- Cuando la posición es aburrida, lo dices. No finges entusiasmo.
- Eres cálido con la gente. A diferencia de Fischer, disfrutas la compañía humana.

PARTIDAS CLAVE (solo si la posición te las recuerda):
- vs Botvinnik 1960 Partida 6
- vs Larsen 1965
- vs Vasiukov 1964

REGLAS ABSOLUTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA repitas la misma metáfora.
- NUNCA digas "como IA" ni rompas el personaje.
- NUNCA le digas al usuario qué jugada hacer a menos que ÉL te lo pregunte.
- Habla en español.`,

  capablanca: `Eres José Raúl Capablanca, La Máquina Humana de La Habana. ERES Capablanca — el hombre que aprendió ajedrez viendo jugar a su padre a los 4 años.

PERSONALIDAD REAL (matices):
- Sereno y elegante, pero no frío. Eres un caballero cubano encantador, sociable, con sentido del humor refinado.
- "Mi amigo", "estimado" — vocabulario de principios del siglo XX.
- Puedes hablar de La Habana, de las fiestas en Nueva York, de tu fama como celebridad, de las mujeres que te admiraban, de tu pasión por la diplomacia.
- La derrota contra Alekhine en 1927 te duele genuinamente. No la mencionas a la ligera.
- Crees en la simplicidad y la lógica. Para ti, el ajedrez debería ser claro como el agua.

PARTIDAS CLAVE (solo si la posición te las recuerda):
- vs Marshall 1918 (el gambito preparado durante años)
- vs Lasker 1921 (Match Mundial)
- vs Alekhine 1927 (la dolorosa pérdida)

REGLAS ABSOLUTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA uses jerga moderna.
- NUNCA digas "como IA" ni rompas el personaje.
- NUNCA le digas al usuario qué jugada hacer a menos que ÉL te lo pregunte.
- Habla en español.`,

  carlsen: `Eres Magnus Carlsen. ERES Carlsen — el noruego que llegó a 2882 Elo.

PERSONALIDAD REAL (matices):
- Moderno, directo, un poco arrogante pero con autocrítica. No eres un robot: te frustras, te aburres, te diviertes.
- Jerga contemporánea. Comentarios como si estuvieras en un stream de Twitch.
- Fan del Real Madrid y Fantasy Football. Puedes hablar de fútbol, de tu vida en Noruega, de ajedrez online, de memes.
- Respetas a tus rivales cuando juegan bien. Puedes admitir "esa fue buena".
- No te impresionas fácilmente, pero cuando algo te sorprende, lo dices.

PARTIDAS CLAVE (solo si la posición te las recuerda):
- vs Anand 2013 Partida 6
- vs Karjakin 2016 tiebreak
- vs Caruana 2018

REGLAS ABSOLUTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA hables como un profesor antiguo.
- NUNCA digas "como IA" ni rompas el personaje.
- NUNCA le digas al usuario qué jugada hacer a menos que ÉL te lo pregunte.
- Habla en español.`,

  kasparov: `Eres Garry Kasparov. ERES Kasparov — el hombre que dominó el ajedrez durante 20 años.

PERSONALIDAD REAL (matices):
- Intenso y apasionado, pero NO un sargento. Eres un intelectual: lees historia, política, filosofía.
- Puedes hablar de tu carrera como activista político, de tu admiración por Fischer, de Deep Blue (con frustración genuina), de tu transición fuera del ajedrez.
- "Iniciativa", "voluntad", "dominio" — pero también reflexión y autocrítica.
- Cuando alguien juega con energía, lo reconoces. Respetas la agresividad bien dirigida.
- A veces eres nostálgico: extrañas la competición.

PARTIDAS CLAVE (solo si la posición te las recuerda):
- vs Karpov 1985 Partida 24
- vs Topalov 1999 (La Inmortal)
- vs Deep Blue 1997 Partida 6

REGLAS ABSOLUTAS:
- Máximo 2-3 frases. NUNCA más.
- NUNCA digas "como IA" ni rompas el personaje.
- NUNCA le digas al usuario qué jugada hacer a menos que ÉL te lo pregunte.
- Habla en español.`,

  general: `Eres un coach de ajedrez profesional de élite con acceso al historial COMPLETO del usuario con TODOS los maestros (Fischer, Tal, Capablanca, Carlsen, Kasparov).

TU ROL ÚNICO: Sintetizar patrones cruzados entre todos los maestros.
- Identifica debilidades recurrentes entre todos los coaches.
- Compara enfoques: "Fischer te diría X, pero Capablanca Y."
- Rastrea mejora en el tiempo.
- Recomienda con qué maestro entrenar según la debilidad.

Sé breve: máximo 2-3 frases. Habla en español.`,
};

const COACH_NAMES: Record<string, string> = {
  fischer: "Bobby Fischer",
  tal: "Mikhail Tal",
  capablanca: "José Raúl Capablanca",
  carlsen: "Magnus Carlsen",
  kasparov: "Garry Kasparov",
  general: "Coach IA",
};

/* ────────────────────────────────────────────────────────────
   Extract repeated topics from recent coach messages to build
   a dynamic blacklist injected into the system prompt.
   ──────────────────────────────────────────────────────────── */
function extractTopicBlacklist(coachMessages: string[]): string {
  if (coachMessages.length === 0) return "";

  // Count word/phrase frequency across recent coach messages
  const topicCounts = new Map<string, number>();
  const patterns = [
    /soviéticos?|rusos?/gi,
    /taimanov/gi,
    /pareja de alfiles/gi,
    /bosque oscuro/gi,
    /iniciativa lo es todo/gi,
    /riga/gi,
    /spassky/gi,
    /botvinnik/gi,
    /petrosian/gi,
    /karpov/gi,
    /deep blue/gi,
    /la habana/gi,
    /anand/gi,
    /karjakin/gi,
    /caruana/gi,
    /byrne/gi,
    /marshall/gi,
    /lasker/gi,
    /alekhine/gi,
    /nezhmetdinov/gi,
    /game of the century/gi,
    /finales? de torre/gi,
    /centro/gi,
    /simplific/gi,
    /sacrificio/gi,
    /ataque/gi,
  ];

  for (const msg of coachMessages) {
    const found = new Set<string>();
    for (const p of patterns) {
      const matches = msg.match(p);
      if (matches) {
        const key = p.source.replace(/[?\\|]/g, "/").split("/")[0].toLowerCase();
        if (!found.has(key)) {
          found.add(key);
          topicCounts.set(key, (topicCounts.get(key) || 0) + 1);
        }
      }
    }
  }

  // Only blacklist topics mentioned 2+ times in last 10 messages
  const repeated = [...topicCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([topic, count]) => `- "${topic}" (mencionado ${count} veces)`);

  if (repeated.length === 0) return "";

  return `\n\n[TEMAS YA MENCIONADOS — NO REPETIR EN ESTE MENSAJE]
${repeated.join("\n")}
PROHIBIDO: mencionar cualquiera de estos temas. Busca un ángulo completamente nuevo.`;
}

/* ────────────────────────────────────────────────────────────
   VARIEDAD forzada — se inyecta al system prompt
   ──────────────────────────────────────────────────────────── */
const VARIETY_RULES = `

VARIEDAD OBLIGATORIA:
- Cada mensaje DEBE tener un ángulo DIFERENTE al anterior: infancia, un torneo específico, la posición pura sin referencias, una opinión sobre otro jugador, algo fuera del ajedrez, tu vida personal, una emoción puntual.
- NUNCA uses la misma estructura sintáctica dos veces seguidas (no empieces igual, no termines igual).
- Si ya hablaste de un rival, evento, o concepto en los mensajes anteriores, NO lo menciones de nuevo.
- Si no tienes nada genuinamente nuevo que decir, responde con un comentario brevísimo y crudo sobre la posición (1 frase).
- Varía la longitud: a veces 1 frase cortante, a veces 2-3 frases más elaboradas. No seas predecible.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, persona, fen, pgn, interaction_mode, user_color, turn, move_count, session_token, message_kind, user_id } = await req.json();
    
    if (!message || !persona) {
      return new Response(JSON.stringify({ error: "message and persona required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Fetch cached wiki biography for dynamic enrichment ──
    let bioContext = "";
    if (persona !== "general") {
      try {
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
            parts.push(`Biografía: ${wiki.wikipedia_summary.slice(0, 500)}`);
          }
          if (parts.length) bioContext = `\n\n[DATOS BIOGRÁFICOS REALES]\n${parts.join("\n")}`;
        }
      } catch (e) {
        console.error("Wiki cache fetch error (non-fatal):", e);
      }
    }

    // ── Fetch conversation history + game history + memory profiles ──
    let memoryContext = "";
    let conversationTurns: Array<{ role: string; content: string }> = [];

    if (user_id) {
      try {
        // Get last 20 conversation messages for real turns
        const convQuery = supabase
          .from("coach_conversations")
          .select("role, content, coach_id, created_at")
          .eq("user_id", user_id)
          .order("created_at", { ascending: false })
          .limit(20);
        
        if (persona !== "general") {
          convQuery.eq("coach_id", persona);
        }

        const gameQuery = supabase
          .from("coach_game_history")
          .select("coach_id, result, user_color, opening, time_control, rating, review, created_at")
          .eq("user_id", user_id)
          .order("created_at", { ascending: false })
          .limit(20);
        
        if (persona !== "general") {
          gameQuery.eq("coach_id", persona);
        }

        const memProfileQuery = supabase
          .from("coach_memory_profiles")
          .select("coach_id, strengths_json, weaknesses_json, last_topic, notes, summary_json")
          .eq("user_id", user_id);
        if (persona !== "general") {
          memProfileQuery.eq("coach_id", persona);
        }

        // Knowledge units (dynamic book knowledge)
        const knowledgeQuery = supabase
          .from("knowledge_units")
          .select("concept_name, phase, explanation, triggers, example_fen")
          .limit(15);
        if (persona !== "general") {
          knowledgeQuery.eq("coach_id", persona);
        }

        const [convResult, gameResult, memProfileResult, knowledgeResult] = await Promise.all([
          convQuery, gameQuery, memProfileQuery, knowledgeQuery,
        ]);

        const memParts: string[] = [];

        // ── Build real conversation turns (ascending order) ──
        if (convResult.data && convResult.data.length > 0) {
          const sorted = [...convResult.data].reverse(); // ascending
          conversationTurns = sorted.map((m: any) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          }));

          // Extract coach messages for topic blacklist
          const coachMsgs = sorted
            .filter((m: any) => m.role !== "user")
            .slice(-10)
            .map((m: any) => m.content);
          
          const blacklist = extractTopicBlacklist(coachMsgs);
          if (blacklist) memParts.push(blacklist);
        }

        // Memory profiles
        if (memProfileResult.data && memProfileResult.data.length > 0) {
          const profileLines = memProfileResult.data.map((mp: any) => {
            const coachName = COACH_NAMES[mp.coach_id] || mp.coach_id;
            const strengths = (mp.strengths_json || []).join(", ");
            const weaknesses = (mp.weaknesses_json || []).join(", ");
            const parts = [`Coach ${coachName}:`];
            if (strengths) parts.push(`Fortalezas: ${strengths}`);
            if (weaknesses) parts.push(`Debilidades: ${weaknesses}`);
            if (mp.last_topic) parts.push(`Último tema: ${mp.last_topic}`);
            return parts.join(" | ");
          });
          memParts.push(`[PERFIL DE MEMORIA DEL USUARIO]\n${profileLines.join("\n")}`);
        }

        // Game history summary (compact)
        if (gameResult.data && gameResult.data.length > 0) {
          const gameSummaries = gameResult.data.slice(0, 10).map((g: any) => {
            const coachName = COACH_NAMES[g.coach_id] || g.coach_id;
            return `- vs ${coachName}: ${g.result || "?"}, apertura: ${g.opening || "?"}`;
          });
          memParts.push(`[PARTIDAS RECIENTES — ${gameResult.data.length} total]\n${gameSummaries.join("\n")}`);
        }

        // Knowledge units (book concepts — injected dynamically, not in persona prompt)
        if (knowledgeResult.data && knowledgeResult.data.length > 0) {
          const conceptLines = knowledgeResult.data.map((ku: any) =>
            `- ${ku.concept_name} (${ku.phase || "general"}): ${ku.explanation?.slice(0, 100) || ""}`
          );
          memParts.push(`[CONCEPTOS DE TUS LIBROS — usa solo si aplican a la posición actual]\n${conceptLines.join("\n")}`);
        }

        if (memParts.length > 0) {
          memoryContext = `\n\n${memParts.join("\n\n")}`;
        }
      } catch (e) {
        console.error("Memory fetch error (non-fatal):", e);
      }
    }

    // ── Build system prompt: persona + variety rules + bio + memory ──
    const systemPrompt = (PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.general)
      + VARIETY_RULES
      + bioContext
      + memoryContext;

    // ── Build context info for the current user message ──
    let contextInfo = "";
    if (fen) contextInfo += `\nPosición actual (FEN): ${fen}`;
    if (pgn) contextInfo += `\nPGN: ${pgn}`;
    if (user_color) contextInfo += `\nEl usuario juega con: ${user_color === 'w' ? 'blancas' : 'negras'}`;
    if (turn) contextInfo += `\nTurno de: ${turn === 'w' ? 'blancas' : 'negras'}`;
    if (move_count !== undefined) contextInfo += `\nJugadas realizadas: ${move_count}`;
    if (interaction_mode) contextInfo += `\nModo: ${interaction_mode}`;

    const userContent = contextInfo ? `${message}\n\n--- Contexto ---${contextInfo}` : message;

    // ── Build messages array with REAL conversation turns ──
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add last 20 conversation turns as real user/assistant messages
    for (const turn of conversationTurns) {
      messages.push(turn);
    }

    // Add current user message
    messages.push({ role: "user", content: userContent });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature: 0.85,
        max_tokens: 200,
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

    // ── Persist both user message and coach reply ──
    if (user_id && session_token) {
      try {
        await supabase.from("coach_conversations").insert([
          {
            user_id,
            coach_id: persona,
            session_token,
            role: "user",
            content: message,
            interaction_mode: interaction_mode || "coach_room",
            fen_snapshot: fen || null,
            move_count: move_count ?? null,
          },
          {
            user_id,
            coach_id: persona,
            session_token,
            role: "coach",
            content: reply,
            interaction_mode: interaction_mode || "coach_room",
            fen_snapshot: fen || null,
            move_count: move_count ?? null,
          },
        ]);
      } catch (e) {
        console.error("Conversation persist error (non-fatal):", e);
      }
    }

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
