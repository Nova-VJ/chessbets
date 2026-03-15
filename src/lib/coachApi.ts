import { supabase } from '@/integrations/supabase/client';

/**
 * Invoke a chess edge function via Lovable Cloud.
 */
export async function invokeChessMove(fen: string, persona: string, timeControl: number) {
  const { data, error } = await supabase.functions.invoke('chess-move', {
    body: { fen, persona, time_control: timeControl },
  });
  if (error) throw error;
  return data as { move: string; san: string };
}

export async function invokeChessChat(params: {
  message: string;
  persona: string;
  fen?: string;
  pgn?: string;
  interaction_mode?: string;
  user_color?: string;
  turn?: string;
  move_count?: number;
  session_token?: string;
  message_kind?: string;
  game_id?: string | null;
  silent?: boolean;
  user_id?: string;
}) {
  const { data, error } = await supabase.functions.invoke('chess-chat', {
    body: params,
  });
  if (error) throw error;
  return data as { reply: string };
}

export async function invokeChessEvaluate(params: {
  pgn: string;
  result: string;
  opponent_id?: string;
  time_control?: number;
  user_id?: string;
  session_token?: string;
}) {
  const { data, error } = await supabase.functions.invoke('chess-evaluate', {
    body: params,
  });
  if (error) throw error;
  return data;
}

// Legacy exports kept for compatibility (no-op)
export function coachApiUrl(path: string) {
  return path;
}
export async function ensureCoachApiAwake() {}
export async function fetchCoachApi(path: string, init?: RequestInit, options?: any) {
  console.warn('fetchCoachApi is deprecated, use invoke* functions instead');
  throw new Error('Coach API has been migrated to edge functions');
}
