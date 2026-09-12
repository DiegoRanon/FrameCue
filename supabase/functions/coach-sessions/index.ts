import type { SupabaseClient } from '@supabase/supabase-js';

import {
  coachSessionsRequest,
  type CoachSessionsCommand,
  type SessionSummary,
} from '../_shared/contract.ts';
import { coachClient, recordEvent, serviceClient } from '../_shared/deno/clients.ts';
import { fail, json, logFailure, readJson, requireEnv } from '../_shared/deno/http.ts';
import { closeRoom, mintCallCredentials } from '../_shared/deno/livekit.ts';
import {
  coachIdentityFor,
  invitationExpiry,
  roomNameFor,
  sessionAccess,
  type SessionStatus,
} from '../_shared/policy.ts';
import { deriveInvitationToken, hashInvitationToken, inviteUrlFor } from '../_shared/tokens.ts';

/**
 * Everything a signed-in coach does that is more than a table read: create a
 * session together with its invitation, copy the link again, get LiveKit
 * credentials, and end the session for both participants.
 *
 * The coach is identified from their own access token, and every read of
 * `sessions` goes through a client acting as them, so RLS still decides what
 * they can reach (FR-01). The service role is used only for the tables coaches
 * can never touch directly.
 */

const SESSION_COLUMNS = 'id, title, student_name, scheduled_at, duration_minutes, status';

type SessionRow = {
  id: string;
  title: string;
  student_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
};

type Command<A extends CoachSessionsCommand['action']> = Extract<
  CoachSessionsCommand,
  { action: A }
>;

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return fail(405, 'bad_request');
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return fail(401, 'unauthorized');
  }

  const parsed = coachSessionsRequest.safeParse(await readJson(request));
  if (!parsed.success) {
    return fail(400, 'bad_request');
  }
  const command = parsed.data;

  try {
    const asCoach = coachClient(authorization);
    const { data, error } = await asCoach.auth.getUser(accessToken);
    if (error || !data.user) {
      return fail(401, 'unauthorized');
    }
    const coachId = data.user.id;

    switch (command.action) {
      case 'create':
        return await create(asCoach, command);
      case 'inviteLink':
        return await inviteLink(asCoach, command);
      case 'join':
        return await join(asCoach, coachId, command);
      case 'end':
        return await end(asCoach, command);
    }
  } catch (error) {
    logFailure(`coach-sessions.${command.action}`, error);
    return fail(500, 'server_error');
  }
});

async function create(asCoach: SupabaseClient, command: Command<'create'>): Promise<Response> {
  const scheduledAt = new Date(command.scheduledAt);
  const expiresAt = invitationExpiry(scheduledAt, command.durationMinutes);
  // A session whose invitation would already be expired can never be joined.
  if (sessionAccess('scheduled', expiresAt, new Date()) !== 'open') {
    return fail(400, 'bad_request');
  }

  const { data: session, error } = await asCoach
    .from('sessions')
    .insert({
      title: command.title,
      student_name: command.studentName ?? null,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: command.durationMinutes,
    })
    .select(SESSION_COLUMNS)
    .single<SessionRow>();
  if (error) {
    throw error;
  }

  const admin = serviceClient();
  const invitationId = crypto.randomUUID();
  const token = await deriveInvitationToken(requireEnv('INVITE_TOKEN_SECRET'), invitationId);
  const { error: invitationError } = await admin.from('invitations').insert({
    id: invitationId,
    session_id: session.id,
    token_hash: await hashInvitationToken(token),
    expires_at: expiresAt.toISOString(),
  });
  if (invitationError) {
    // A session without an invitation cannot be joined; do not leave one behind.
    await admin.from('sessions').delete().eq('id', session.id);
    throw invitationError;
  }

  await recordEvent(admin, session.id, 'session_created', 'coach');
  return json({
    session: toSummary(session),
    inviteUrl: inviteUrlFor(requireEnv('INVITE_BASE_URL'), token),
  });
}

async function inviteLink(
  asCoach: SupabaseClient,
  command: Command<'inviteLink'>,
): Promise<Response> {
  const session = await ownSession(asCoach, command.sessionId);
  if (!session) {
    return fail(404, 'not_found');
  }
  if (session.status === 'ended') {
    return fail(410, 'session_ended');
  }

  const { data: invitation, error } = await serviceClient()
    .from('invitations')
    .select('id')
    .eq('session_id', session.id)
    .single<{ id: string }>();
  if (error) {
    throw error;
  }

  const token = await deriveInvitationToken(requireEnv('INVITE_TOKEN_SECRET'), invitation.id);
  return json({ inviteUrl: inviteUrlFor(requireEnv('INVITE_BASE_URL'), token) });
}

async function join(
  asCoach: SupabaseClient,
  coachId: string,
  command: Command<'join'>,
): Promise<Response> {
  const session = await ownSession(asCoach, command.sessionId);
  if (!session) {
    return fail(404, 'not_found');
  }

  const expiresAt = invitationExpiry(new Date(session.scheduled_at), session.duration_minutes);
  const access = sessionAccess(session.status, expiresAt, new Date());
  if (access !== 'open') {
    return fail(410, access === 'ended' ? 'session_ended' : 'session_expired');
  }

  const { data: coach, error } = await asCoach
    .from('coaches')
    .select('display_name')
    .eq('id', coachId)
    .single<{ display_name: string | null }>();
  if (error) {
    throw error;
  }

  await recordEvent(serviceClient(), session.id, 'participant_join_attempted', 'coach');
  return json(
    await mintCallCredentials({
      identity: coachIdentityFor(coachId),
      name: coach.display_name ?? 'Coach',
      room: roomNameFor(session.id),
    }),
  );
}

async function end(asCoach: SupabaseClient, command: Command<'end'>): Promise<Response> {
  const session = await ownSession(asCoach, command.sessionId);
  if (!session) {
    return fail(404, 'not_found');
  }

  const admin = serviceClient();
  if (session.status !== 'ended') {
    const now = new Date().toISOString();
    // The status goes first. Once it commits, neither participant can get new
    // credentials, whatever happens to the room call below.
    const { error } = await admin
      .from('sessions')
      .update({ status: 'ended', ended_at: now })
      .eq('id', session.id)
      .eq('status', 'scheduled');
    if (error) {
      throw error;
    }

    const { error: invitationError } = await admin
      .from('invitations')
      .update({ expires_at: now })
      .eq('session_id', session.id)
      .gt('expires_at', now);
    if (invitationError) {
      throw invitationError;
    }

    await recordEvent(admin, session.id, 'session_ended', 'coach');
  }

  // Deleting the room disconnects both participants with ROOM_DELETED, which is
  // what puts the student's screen on "Session ended".
  const roomClosed = await closeRoom(roomNameFor(session.id));
  return json({ ended: true, roomClosed });
}

/**
 * RLS returns nothing for another coach's session, which is indistinguishable
 * from one that does not exist - as it should be.
 */
async function ownSession(asCoach: SupabaseClient, sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await asCoach
    .from('sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle<SessionRow>();
  if (error) {
    throw error;
  }
  return data;
}

function toSummary(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    title: row.title,
    studentName: row.student_name,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
  };
}
