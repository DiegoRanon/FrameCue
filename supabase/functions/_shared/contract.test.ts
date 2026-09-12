import { coachSessionsRequest, invitationPreview, invitationRequest } from './contract.ts';

const SESSION_ID = '5b0f8a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const TOKEN = 'A'.repeat(40) + '_-9';

describe('coachSessionsRequest', () => {
  const create = {
    action: 'create',
    title: '  Footwork  ',
    scheduledAt: '2026-09-12T10:00:00.000Z',
    durationMinutes: 45,
  };

  it('accepts a session and trims its title', () => {
    const parsed = coachSessionsRequest.parse(create);
    expect(parsed).toMatchObject({ action: 'create', title: 'Footwork', durationMinutes: 45 });
  });

  it('rejects durations other than 30, 45, or 60 minutes', () => {
    expect(coachSessionsRequest.safeParse({ ...create, durationMinutes: 40 }).success).toBe(false);
  });

  it('rejects a blank or oversized title', () => {
    expect(coachSessionsRequest.safeParse({ ...create, title: '   ' }).success).toBe(false);
    expect(coachSessionsRequest.safeParse({ ...create, title: 'x'.repeat(81) }).success).toBe(
      false,
    );
  });

  it('rejects a timestamp that is not ISO 8601', () => {
    expect(coachSessionsRequest.safeParse({ ...create, scheduledAt: 'tomorrow' }).success).toBe(
      false,
    );
  });

  it('requires consent before a coach joins', () => {
    const join = { action: 'join', sessionId: SESSION_ID };
    expect(coachSessionsRequest.safeParse(join).success).toBe(false);
    expect(coachSessionsRequest.safeParse({ ...join, consentAccepted: false }).success).toBe(false);
    expect(coachSessionsRequest.safeParse({ ...join, consentAccepted: true }).success).toBe(true);
  });

  it('rejects a session id that is not a UUID', () => {
    expect(coachSessionsRequest.safeParse({ action: 'end', sessionId: '42' }).success).toBe(false);
  });
});

describe('invitationRequest', () => {
  const join = {
    action: 'join',
    token: TOKEN,
    displayName: ' Sam  Rivera ',
    consentAccepted: true,
  };

  it('normalizes the display name', () => {
    expect(invitationRequest.parse(join)).toMatchObject({ displayName: 'Sam Rivera' });
  });

  it('rejects a blank or oversized display name', () => {
    expect(invitationRequest.safeParse({ ...join, displayName: '  ' }).success).toBe(false);
    expect(invitationRequest.safeParse({ ...join, displayName: 'x'.repeat(61) }).success).toBe(
      false,
    );
  });

  it('requires consent', () => {
    expect(invitationRequest.safeParse({ ...join, consentAccepted: undefined }).success).toBe(
      false,
    );
  });

  it('rejects anything that cannot be an invitation token', () => {
    expect(invitationRequest.safeParse({ action: 'preview', token: 'short' }).success).toBe(false);
    expect(
      invitationRequest.safeParse({ action: 'preview', token: `${TOKEN.slice(1)}/` }).success,
    ).toBe(false);
    expect(invitationRequest.safeParse({ action: 'preview', token: TOKEN }).success).toBe(true);
  });
});

describe('invitationPreview', () => {
  it('accepts an invalid invitation with no session details', () => {
    expect(invitationPreview.parse({ state: 'invalid' })).toEqual({ state: 'invalid' });
  });

  it('requires session details for a known invitation', () => {
    expect(invitationPreview.safeParse({ state: 'open' }).success).toBe(false);
  });
});
