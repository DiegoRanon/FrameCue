/**
 * Session and invitation rules shared by the edge functions and the app.
 *
 * Deliberately import-free, so the same file runs under Deno, Metro, and Jest,
 * and the server and the coach's dashboard cannot disagree about whether a
 * session is still open.
 */

/** Spec section 12: 30, 45, or 60 minutes, with no billing rules attached. */
export const SESSION_DURATIONS = [30, 45, 60] as const;
export type SessionDuration = (typeof SESSION_DURATIONS)[number];

export const TITLE_MAX_LENGTH = 80;
export const PERSON_NAME_MAX_LENGTH = 60;

/**
 * Spec section 5.1: an invitation expires when the session ends, and may also
 * expire after a post-session window. An hour past the scheduled end leaves
 * room for a lesson that starts late; End Session closes it immediately.
 */
export const POST_SESSION_WINDOW_MINUTES = 60;

export type SessionStatus = 'scheduled' | 'ended';

/** Whether a session can still be joined, by either participant. */
export type SessionAccess = 'open' | 'expired' | 'ended';

export function invitationExpiry(scheduledAt: Date, durationMinutes: number): Date {
  const minutes = durationMinutes + POST_SESSION_WINDOW_MINUTES;
  return new Date(scheduledAt.getTime() + minutes * 60_000);
}

export function sessionAccess(status: SessionStatus, expiresAt: Date, now: Date): SessionAccess {
  if (status === 'ended') {
    return 'ended';
  }
  return now.getTime() < expiresAt.getTime() ? 'open' : 'expired';
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

/**
 * Names are typed on a phone and end up as the LiveKit participant name, so
 * control characters go and runs of whitespace collapse. Length is checked by
 * the contract afterwards, on the normalized value.
 */
export function normalizePersonName(raw: string): string {
  return raw.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim();
}

/** One LiveKit room per session. */
export function roomNameFor(sessionId: string): string {
  return `framecue-${sessionId}`;
}

/**
 * Identities are fixed rather than random. LiveKit evicts an older connection
 * with the same identity, so a forwarded invitation cannot put a second student
 * into a one-to-one lesson (section 5.1), and a coach on two devices is still
 * one coach.
 */
export function coachIdentityFor(coachId: string): string {
  return `coach-${coachId}`;
}

export function studentIdentityFor(invitationId: string): string {
  return `student-${invitationId}`;
}

/** An HMAC-SHA256 digest in unpadded base64url is always 43 characters. */
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
