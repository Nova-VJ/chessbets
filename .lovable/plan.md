

## Plan: Full Book Libraries + Unlimited Memory Per Master

### What Changes

Two edge functions get rewritten with complete book knowledge and unlimited memory access.

### 1. `supabase/functions/chess-chat/index.ts`

**Rewrite all 5 PERSONA_PROMPTS** with full book catalogs per master:

- **Fischer** (4 books): *My 60 Memorable Games* (initiative, bishop pair, concrete calculation), *Bobby Fischer Teaches Chess* (pattern recognition, back-rank mates, pins/forks), *Bobby Fischer's Games of Chess* (1.e4 precision, Sicilian mastery, endgame technique), *Checkmate: Boys' Life Columns* (teaching tactics to beginners, simple combinations, mating patterns)

- **Tal** (3 books): *The Life and Games of Mikhail Tal* (intuitive sacrifices, complicating the position, "the dark forest"), *Mikhail Tal's Best Games* (exchange sacrifices for activity, piece coordination in attack), *Tal-Botvinnik 1960* (psychological warfare, preparation against a specific opponent, breaking defensive systems)

- **Capablanca** (3 books): *Chess Fundamentals* (simplification when ahead, pawn structure integrity, endgame technique), *A Primer of Chess* (basic principles as foundation, piece development, center control), *My Chess Career* (tournament strategy, match psychology, classical positional play)

- **Kasparov** (4 books): *My Great Predecessors* (dynamic play, learning from all champions, evolution of chess), *Modern Chess* (computer-era preparation, concrete analysis), *How Life Imitates Chess* (decision-making under pressure, strategic thinking beyond the board), *Revolution in the 70s* (Fischer's impact, the Karpov era, Soviet chess school evolution)

- **Carlsen** (4 books about him): *Endgame Virtuoso Magnus Carlsen* (squeezing water from stone, prophylactic endgame play), *Attack with Magnus Carlsen* (practical attacking, exploiting inaccuracies), *Magnus Carlsen: 60 Memorable Games* (versatility, grinding technique), *Wonderboy: Magnus Carlsen* (rise to the top, early prodigy years)

Each book entry includes TRIGGERS (board conditions that activate the concept) and ANTI-PATTERNS (what NOT to do).

**Memory limits**: Remove the `.limit(20)` and `.limit(10)` caps entirely — fetch ALL messages and ALL games for each user/coach pair. For general coach, fetch ALL across all coaches.

**max_tokens**: 150 → 200.

**General coach prompt**: Enriched to explicitly synthesize cross-master patterns, identify recurring weaknesses, compare how different masters approach the same problem, and track improvement over time using all available data.

### 2. `supabase/functions/chess-move/index.ts`

Add book-driven play guidance to each PERSONA_STYLES:
- Fischer: "If you have the bishop pair, open the position" (My 60 Memorable Games)
- Tal: "If a sacrifice creates 3+ threats, play it even if unclear" (Life and Games)
- Capablanca: "When ahead, trade pieces not pawns. Activate king early" (Chess Fundamentals)
- Carlsen: "Avoid forced draws. Prefer positions needing 50+ precise moves" (Endgame Virtuoso)
- Kasparov: "Seize central control first, then attack with full energy" (My Great Predecessors)

### Files

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/chess-chat/index.ts` | Full book libraries, unlimited memory, max_tokens 200, enriched general coach |
| 2 | `supabase/functions/chess-move/index.ts` | Book-driven play style per master |

