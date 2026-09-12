/**
 * Invitation tokens (NFR-08).
 *
 * A token is HMAC-SHA256(secret, invitation id): 256 bits nobody can guess, and
 * one the server can derive again whenever the coach wants to copy the link.
 * The database stores only a SHA-256 of it, so neither a table dump nor a log
 * line can open a lesson, and no raw token ever has to be stored (NFR-10).
 *
 * Web Crypto only, so this runs unchanged under Deno and in Jest.
 */

const encoder = new TextEncoder();

export async function deriveInvitationToken(secret: string, invitationId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`framecue-invitation:${invitationId}`),
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function hashInvitationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function inviteUrlFor(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/join/${token}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
