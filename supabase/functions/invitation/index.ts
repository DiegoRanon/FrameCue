import type { SupabaseClient } from '@supabase/supabase-js';

import { invitationRequest } from '../_shared/contract.ts';
import { recordEvent, serviceClient } from '../_shared/deno/clients.ts';
import { fail, json, logFailure, readJson } from '../_shared/deno/http.ts';
import { mintCallCredentials } from '../_shared/deno/livekit.ts';
import {
  roomNameFor,
  sessionAccess,
  studentIdentityFor,
  type SessionAccess,
  type SessionStatus,
} from '../_shared/policy.ts';
import { hashInvitationToken } from '../_shared/tokens.ts';

/**
 * The student's side of an invitation (FR-03): no account and no auth header.
 * The token in the link is the only credential, and it is looked up by its
 * hash, so the raw token is never stored and never logged (NFR-08, NFR-10).
 */

const INVITATION_COLUMNS =
  'id, expires_at, used_at, session:sessions!inner(id, title, scheduled_at, duration_minutes, status, coach:coaches!inner(display_name))';

type InvitationRow = {
  id: string;
  expires_at: string;
  used_at: string | null;
  session: {
    id: string;
    title: string;
    scheduled_at: string;
    duration_minutes: number;
    status: SessionStatus;
    coach: { display_name: string | null };
  };
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return fail(405, 'bad_request');
  }

  const parsed = invitationRequest.safeParse(await readJson(request));
  if (!parsed.success) {
    return fail(400, 'bad_request');
  }
  const command = parsed.data;

  try {
    const admin = serviceClient();
    const invitation = await findInvitation(admin, command.token);
    if (command.action === 'preview') {
      return preview(invitation);
    }
    return await join(admin, invitation, command.displayName);
  } catch (error) {
    logFailure(`invitation.${command.action}`, error);
    return fail(500, 'server_error');
  }
});

/** What the join screen shows before the student commits to anything. */
function preview(invitation: InvitationRow | null): Response {
  if (!invitation) {
    return json({ state: 'invalid' });
  }
  const { session } = invitation;
  return json({
    state: accessOf(invitation),
    coachName: session.coach.display_name ?? 'Your coach',
    title: session.title,
    scheduledAt: session.scheduled_at,
    durationMinutes: session.duration_minutes,
  });
}

async function join(
  admin: SupabaseClient,
  invitation: InvitationRow | null,
  displayName: string,
): Promise<Response> {
  if (!invitation) {
    return fail(404, 'not_found');
  }

  const access = accessOf(invitation);
  if (access !== 'open') {
    return fail(410, access === 'ended' ? 'session_ended' : 'session_expired');
  }

  // An invitation is reusable until it expires: rejoining after a dropped
  // connection or a force-close opens the same link again (AC-12, AC-14).
  if (!invitation.used_at) {
    const { error } = await admin
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invitation.id)
      .is('used_at', null);
    if (error) {
      throw error;
    }
  }

  await recordEvent(admin, invitation.session.id, 'participant_join_attempted', 'student');
  return json(
    await mintCallCredentials({
      identity: studentIdentityFor(invitation.id),
      name: displayName,
      room: roomNameFor(invitation.session.id),
    }),
  );
}

async function findInvitation(admin: SupabaseClient, token: string): Promise<InvitationRow | null> {
  const { data, error } = await admin
    .from('invitations')
    .select(INVITATION_COLUMNS)
    .eq('token_hash', await hashInvitationToken(token))
    .maybeSingle<InvitationRow>();
  if (error) {
    throw error;
  }
  return data;
}

function accessOf(invitation: InvitationRow): SessionAccess {
  return sessionAccess(invitation.session.status, new Date(invitation.expires_at), new Date());
}
