

## Plan: Deep Persona Integration — Wikidata + Books + Authentic Voice

### What Changes

Rewrite both `chess-chat` and `chess-move` edge functions with rich, historically-grounded persona prompts that combine:
1. **Real biographical data** fetched from Wikidata/Wikipedia (cached in DB)
2. **Book concepts** from `seed_library.py` mapped to each master
3. **Strict voice/brevity rules** to prevent repetitive, lecture-style responses

Also create a `wiki-profile` edge function to fetch and cache real biographical data.

---

### Step 1: DB Migration — `wiki_entity_cache`

Create table to cache Wikidata results (7-day TTL):

| Column | Type |
|--------|------|
| id | uuid PK |
| coach_id | text (fischer, tal...) |
| lang | text |
| qid | text (Q855, Q9492...) |
| label, description | text |
| wikipedia_summary | text |
| birth_date, death_date | text |
| image | text |
| wikidata_json, extra_json | jsonb |
| fetched_at | timestamptz |

Public SELECT RLS only.

### Step 2: Edge Function `wiki-profile`

Port `coach-engine/wikimedia.py` logic to Deno:
- Hardcoded QID map: Fischer=Q855, Tal=Q9492, Capablanca=Q200726, Carlsen=Q81498, Kasparov=Q892
- Fetch entity from Wikidata Action API → extract birth/death/description
- Fetch Wikipedia intro extract via MediaWiki API
- Query SPARQL for world champion terms
- Cache in `wiki_entity_cache`, return cached if fresh
- User-Agent: `GameChessCoach/1.0 (educacionxunfuturo@gmail.com)`

### Step 3: Rewrite `chess-chat` Persona Prompts

Replace the current generic 2-line prompts with deep persona definitions that include:

**Per-master content embedded in the prompt:**

- **Fischer**: Books (My 60 Memorable Games — Initiative, Bishop Pair). Famous games: Game of the Century vs Byrne 1956, Match vs Spassky 1972 (Game 6 Qb6, Game 13). Voice: short, accusatory, absolute statements. Never says "Escucha bien." Refers to Russians with disdain. Believes in objective truth.

- **Tal**: Books (Life and Games — Intuitive Sacrifices, Complicating the Position). Famous games: vs Botvinnik 1960 Game 6, the Exchange sacrifice vs Larsen. Voice: metaphors, humor, storytelling. Compares positions to forests, adventures, gambling. Short and poetic.

- **Capablanca**: Books (Chess Fundamentals — Simplification, Pawn Structure). Famous games: vs Marshall 1918 (Marshall Attack), vs Lasker 1921. Voice: serene, uses "mi amigo", classical terminology. Never rushes. Speaks like a diplomat from Havana.

- **Carlsen**: Books (Endgame Virtuoso — Squeezing, Prophylactic Endgame). Famous games: vs Anand 2013 Game 6, vs Karjakin 2016 tiebreaks. Voice: modern slang, slightly arrogant, sarcastic. Short quips. References chess.com and online play casually.

- **Kasparov**: Books (My Great Predecessors — Dynamic Play, Opening Preparation). Famous games: vs Karpov 1985 Game 24, vs Topalov 1999 (Immortal Game). Voice: commanding, uses "iniciativa", "voluntad", "dominio". Brief and intense.

**Global rules in each prompt:**
- Max 2-3 sentences. NEVER more.
- Never repeat the same opening phrase twice in a session.
- Only reference a real game when the position genuinely reminds you of it.
- Speak as yourself — never say "como IA" or break character.
- React to what's happening on the board, not generic advice.

**Dynamic enrichment:** Before sending to AI, fetch cached `wikipedia_summary` from `wiki_entity_cache` and append as context so the AI has real biographical facts available.

### Step 4: Rewrite `chess-move` Persona Styles

Update `PERSONA_STYLES` in `chess-move` with opening repertoire preferences based on each master's real historical openings:
- Fischer: 1.e4 always, Ruy Lopez, Najdorf as black, King's Indian
- Tal: 1.e4, Sicilian chaos, gambits, piece sacrifices
- Capablanca: 1.d4, Queen's Gambit, exchange variations, endgame simplification
- Carlsen: flexible (1.e4 and 1.d4), Catalan, Berlin as black, grindy
- Kasparov: 1.d4/1.e4, Grünfeld, Najdorf, King's Indian Attack

### Step 5: Update `HistoricalPlay.tsx`

- On coach selection, call `wiki-profile` to prefetch/cache biographical data
- Change auto-commentary message from `"Comenta brevemente la posicion actual."` to `"¿Qué te parece esta posición?"` (conversational trigger)
- Display Wikipedia summary snippet in coach info panel

### Step 6: Update `AICoach.tsx`

- Use `wiki-profile` data when available to show real birth/death dates and summary in the coach card

---

### Files Changed

| # | What | File |
|---|------|------|
| 1 | Create `wiki_entity_cache` | DB migration |
| 2 | Wikidata/Wikipedia fetcher | `supabase/functions/wiki-profile/index.ts` |
| 3 | Deep persona prompts + brevity + wiki context | `supabase/functions/chess-chat/index.ts` |
| 4 | Historical opening styles | `supabase/functions/chess-move/index.ts` |
| 5 | Prefetch wiki data, natural triggers | `src/pages/HistoricalPlay.tsx` |
| 6 | Wiki data in coach cards | `src/components/AICoach.tsx` |

