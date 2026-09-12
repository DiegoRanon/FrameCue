import type { SessionSummary } from '@shared/contract';
import { invitationExpiry, sessionAccess, type SessionStatus } from '@shared/policy';

/** The columns a coach reads from `sessions` through RLS. */
export const SESSION_COLUMNS = 'id, title, student_name, scheduled_at, duration_minutes, status';

export type SessionRow = {
  id: string;
  title: string;
  student_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
};

export function toSessionSummary(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    title: row.title,
    studentName: row.student_name,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
  };
}

/**
 * Whether the session can still be joined, by the same rule the edge functions
 * apply, so the dashboard never lists a session the backend would refuse.
 */
export function isJoinable(session: SessionSummary, now: Date): boolean {
  const expiresAt = invitationExpiry(new Date(session.scheduledAt), session.durationMinutes);
  return sessionAccess(session.status, expiresAt, now) === 'open';
}
