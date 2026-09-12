import {
  coachIdentityFor,
  invitationExpiry,
  normalizePersonName,
  roomNameFor,
  sessionAccess,
  studentIdentityFor,
} from './policy.ts';

const at = (iso: string) => new Date(iso);

describe('invitationExpiry', () => {
  it('lasts one hour past the scheduled end', () => {
    expect(invitationExpiry(at('2026-09-12T10:00:00Z'), 45).toISOString()).toBe(
      '2026-09-12T11:45:00.000Z',
    );
  });
});

describe('sessionAccess', () => {
  const expiresAt = at('2026-09-12T12:00:00Z');

  it('is open before the invitation expires', () => {
    expect(sessionAccess('scheduled', expiresAt, at('2026-09-12T11:59:59Z'))).toBe('open');
  });

  it('is expired from the expiry instant onwards', () => {
    expect(sessionAccess('scheduled', expiresAt, expiresAt)).toBe('expired');
  });

  it('reports an ended session as ended even before its expiry', () => {
    expect(sessionAccess('ended', expiresAt, at('2026-09-12T09:00:00Z'))).toBe('ended');
  });
});

describe('normalizePersonName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizePersonName('  Sam \n  Rivera  ')).toBe('Sam Rivera');
  });

  it('replaces control characters', () => {
    expect(normalizePersonName('Sam\u0000Rivera')).toBe('Sam Rivera');
  });

  it('keeps non-Latin names intact', () => {
    expect(normalizePersonName('José Núñez')).toBe('José Núñez');
  });

  it('reduces a blank name to an empty string', () => {
    expect(normalizePersonName(' \t ')).toBe('');
  });
});

describe('LiveKit naming', () => {
  it('derives stable room and identity names', () => {
    expect(roomNameFor('s1')).toBe('framecue-s1');
    expect(coachIdentityFor('c1')).toBe('coach-c1');
    expect(studentIdentityFor('i1')).toBe('student-i1');
  });
});
