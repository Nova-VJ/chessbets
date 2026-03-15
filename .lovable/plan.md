

## Plan: Fix All Build Errors and Restore Preview

The build is broken because the code references 2 database tables and several columns that don't exist yet. Here's exactly what needs to happen:

---

### Step 1: Database Migration — Create Missing Tables & Alter `games`

A single migration to:

**Create `lobby_games` table** with columns: `id`, `creator_user_id`, `joiner_user_id`, `status`, `time_control_minutes`, `increment_seconds`, `mode`, `wager_amount`, `currency`, `contract_game_id`, `payment_method`, `accept_creator`, `accept_joiner`, `accept_deadline_at`, `creator_rating_snapshot`, `creator_games_played_snapshot`, `joiner_rating_snapshot`, `joiner_games_played_snapshot`, `created_at`. RLS enabled, realtime enabled.

**Create `game_messages` table** with columns: `id`, `game_id` (FK→games), `user_id` (FK→profiles), `content`, `created_at`. RLS enabled, realtime enabled.

**Alter `games` table** — add columns: `lobby_id`, `fen`, `white_user_id` (FK→profiles), `black_user_id` (FK→profiles), `white_time_ms`, `black_time_ms`, `time_control_minutes`, `increment_seconds`, `last_move_at`, `pgn`, `result`, `winner_user_id` (FK→profiles).

---

### Step 2: Fix `Play.tsx` — Undefined `session`

Line 120 uses `session` which is not defined. Fix: get it from `useAuth()` context (which already exposes `session`). Change destructuring on line 39 from `{ user, profile }` to `{ user, profile, session }`.

---

### Step 3: Fix dev script — Remove Python dependency

The `scripts/dev.mjs` tries to launch a Python server which fails in the Lovable environment. Change the `dev` script in `package.json` to just run `vite` (same as `dev:web`), removing the coach-engine dependency for the preview build.

---

### Summary

| # | What | Files |
|---|------|-------|
| 1 | Create `lobby_games`, `game_messages`, alter `games` | DB migration |
| 2 | Fix `session` undefined | `src/pages/Play.tsx` line 39 |
| 3 | Fix dev script | `package.json` |

All TypeScript errors about `lobby_games` and `game_messages` not existing will resolve automatically once the migration runs and types regenerate.

