-- Create matchmaking queue table
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stake_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'BNB',
  time_control integer NOT NULL DEFAULT 600,
  rating integer NOT NULL DEFAULT 1200,
  status text NOT NULL DEFAULT 'searching',
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  matched_at timestamp with time zone,
  game_id uuid REFERENCES public.games(id),
  UNIQUE(user_id, status)
);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view queue" ON public.matchmaking_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join queue" ON public.matchmaking_queue
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue entry" ON public.matchmaking_queue
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can leave queue" ON public.matchmaking_queue
  FOR DELETE TO authenticated USING (auth.uid() = user_id);