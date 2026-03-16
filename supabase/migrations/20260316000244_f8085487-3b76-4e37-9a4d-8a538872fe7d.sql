
-- =============================================
-- PHASE 1: Add missing columns to games table
-- =============================================
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS moves jsonb DEFAULT '[]';
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'internal';
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BNB';

-- =============================================
-- PHASE 2: Add missing columns to profiles
-- =============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance_usdt numeric NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating_bullet integer NOT NULL DEFAULT 1200;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating_blitz integer NOT NULL DEFAULT 1200;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating_rapid integer NOT NULL DEFAULT 1200;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS draws integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;

-- =============================================
-- PHASE 3: Coach memory tables
-- =============================================

-- Coach memory profiles (summarized memory per user-coach pair)
CREATE TABLE IF NOT EXISTS public.coach_memory_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id text NOT NULL,
  summary_json jsonb DEFAULT '{}',
  strengths_json jsonb DEFAULT '[]',
  weaknesses_json jsonb DEFAULT '[]',
  last_topic text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, coach_id)
);
ALTER TABLE public.coach_memory_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own memory profiles" ON public.coach_memory_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages memory profiles" ON public.coach_memory_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Coach reference log
CREATE TABLE IF NOT EXISTS public.coach_reference_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id text NOT NULL,
  source_type text NOT NULL,
  source_key text,
  session_token text,
  game_id uuid,
  cited_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_reference_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reference logs" ON public.coach_reference_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages reference logs" ON public.coach_reference_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Master games (historical reference games)
CREATE TABLE IF NOT EXISTS public.master_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  white text NOT NULL,
  black text NOT NULL,
  result text,
  event text,
  date text,
  opening text,
  eco text,
  pgn text,
  fen_list jsonb DEFAULT '[]',
  coach_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.master_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read master games" ON public.master_games FOR SELECT USING (true);
CREATE POLICY "Service role manages master games" ON public.master_games FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Knowledge sources
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  license_type text DEFAULT 'fair_use',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read knowledge sources" ON public.knowledge_sources FOR SELECT USING (true);
CREATE POLICY "Service role manages knowledge sources" ON public.knowledge_sources FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Knowledge units
CREATE TABLE IF NOT EXISTS public.knowledge_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  concept_name text NOT NULL,
  phase text,
  explanation text,
  triggers text,
  anti_patterns text,
  example_fen text,
  recommended_drill text,
  coach_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read knowledge units" ON public.knowledge_units FOR SELECT USING (true);
CREATE POLICY "Service role manages knowledge units" ON public.knowledge_units FOR ALL TO service_role USING (true) WITH CHECK (true);
