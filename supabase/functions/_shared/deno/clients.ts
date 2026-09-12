import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { logFailure, requireEnv } from './http.ts';

const withoutSession = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

/**
 * Bypasses RLS. Used only for what no client may touch directly: invitations,
 * session events, and ending a session.
 */
export function serviceClient(): SupabaseClient {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    withoutSession,
  );
}

/** Acts as the signed-in coach, so every query is still decided by RLS (FR-01). */
export function coachClient(authorization: string): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    ...withoutSession,
    global: { headers: { Authorization: authorization } },
  });
}

export type SessionEventType = 'session_created' | 'participant_join_attempted' | 'session_ended';

/** Telemetry never blocks a lesson: a failed insert is logged and dropped. */
export async function recordEvent(
  admin: SupabaseClient,
  sessionId: string,
  eventType: SessionEventType,
  actorRole: 'coach' | 'student',
): Promise<void> {
  const { error } = await admin
    .from('session_events')
    .insert({ session_id: sessionId, event_type: eventType, actor_role: actorRole });
  if (error) {
    logFailure(`session_events.${eventType}`, error);
  }
}
