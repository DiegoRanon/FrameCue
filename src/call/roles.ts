/**
 * A session has exactly one coach and one student (spec section 5.1). The role
 * comes from how the session was opened: from the signed-in coach's dashboard,
 * or from an invitation link (student).
 */
export type CallRole = 'coach' | 'student';

export const CALL_ROLES: readonly CallRole[] = ['coach', 'student'];

export function parseRole(value: unknown): CallRole | null {
  return typeof value === 'string' && (CALL_ROLES as readonly string[]).includes(value)
    ? (value as CallRole)
    : null;
}

/** The role of the other participant, whose video fills the stage. */
export function otherRole(role: CallRole): CallRole {
  return role === 'coach' ? 'student' : 'coach';
}

export const roleLabel: Record<CallRole, string> = {
  coach: 'Coach',
  student: 'Student',
};
