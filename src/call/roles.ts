/**
 * A session has exactly one coach and one student (spec section 5.1).
 * Until M6 the role is chosen on a development screen; after that it comes
 * from the account (coach) or the invitation deep link (student).
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
