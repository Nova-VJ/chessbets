
-- Coach conversations table
CREATE TABLE public.coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id text NOT NULL,
  session_token text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'coach')),
  content text NOT NULL,
  interaction_mode text DEFAULT 'coach_room',
  fen_snapshot text,
  move_count integer,
  game_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_conv_user_coach ON public.coach_conversations(user_id, coach_id, created_at DESC);
CREATE INDEX idx_coach_conv_session ON public.coach_conversations(session_token);

ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.coach_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON public.coach_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Coach game history table
CREATE TABLE public.coach_game_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id text NOT NULL,
  session_token text,
  result text,
  user_color text DEFAULT 'w',
  pgn text,
  opening text,
  time_control integer DEFAULT 10,
  rating integer,
  review text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coach_game_user ON public.coach_game_history(user_id, coach_id, created_at DESC);

ALTER TABLE public.coach_game_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own game history" ON public.coach_game_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game history" ON public.coach_game_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own game history" ON public.coach_game_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Service role policies for edge functions
CREATE POLICY "Service role manages conversations" ON public.coach_conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages game history" ON public.coach_game_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime for conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_conversations;
