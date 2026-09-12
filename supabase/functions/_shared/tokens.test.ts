/**
 * @jest-environment node
 */
import { INVITATION_TOKEN_PATTERN } from './policy.ts';
import { deriveInvitationToken, hashInvitationToken, inviteUrlFor } from './tokens.ts';

const SECRET = 'test-secret';
const INVITATION_ID = '5b0f8a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('deriveInvitationToken', () => {
  it('derives the same token every time, so a coach can copy the link again', async () => {
    const first = await deriveInvitationToken(SECRET, INVITATION_ID);
    await expect(deriveInvitationToken(SECRET, INVITATION_ID)).resolves.toBe(first);
  });

  it('produces a URL-safe token the contract accepts', async () => {
    const token = await deriveInvitationToken(SECRET, INVITATION_ID);
    expect(token).toMatch(INVITATION_TOKEN_PATTERN);
  });

  it('differs per invitation and per secret', async () => {
    const token = await deriveInvitationToken(SECRET, INVITATION_ID);
    await expect(deriveInvitationToken(SECRET, 'another-invitation')).resolves.not.toBe(token);
    await expect(deriveInvitationToken('rotated-secret', INVITATION_ID)).resolves.not.toBe(token);
  });
});

describe('hashInvitationToken', () => {
  it('stores a hex SHA-256 that does not contain the token', async () => {
    const token = await deriveInvitationToken(SECRET, INVITATION_ID);
    const hash = await hashInvitationToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
});

describe('inviteUrlFor', () => {
  it('builds a join link without doubling slashes', () => {
    expect(inviteUrlFor('https://invite.example/', 'abc')).toBe('https://invite.example/join/abc');
  });
});
