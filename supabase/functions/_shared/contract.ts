import { z } from 'zod';

import {
  INVITATION_TOKEN_PATTERN,
  normalizePersonName,
  PERSON_NAME_MAX_LENGTH,
  SESSION_DURATIONS,
  TITLE_MAX_LENGTH,
} from './policy.ts';

/**
 * The wire contract between the app and the edge functions.
 *
 * Both sides import this file: the functions validate what arrives, the app
 * validates what comes back, so neither can drift from the other - the same
 * idea as the `ReplayCommand` union shared by the replay controls and the data
 * channel (D-014). Nothing here can carry media; the largest free-text field is
 * a session title.
 */

const sessionId = z.uuid();
const invitationToken = z.string().regex(INVITATION_TOKEN_PATTERN);
const personName = z
  .string()
  .transform(normalizePersonName)
  .pipe(z.string().min(1).max(PERSON_NAME_MAX_LENGTH));
/** FR-04: consent is required on the wire, never defaulted. */
const consentAccepted = z.literal(true);

export const coachSessionsRequest = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
    scheduledAt: z.iso.datetime({ offset: true }),
    durationMinutes: z.literal(SESSION_DURATIONS),
    studentName: personName.optional(),
  }),
  z.object({ action: z.literal('inviteLink'), sessionId }),
  z.object({ action: z.literal('join'), sessionId, consentAccepted }),
  z.object({ action: z.literal('end'), sessionId }),
]);

/** What the app sends. */
export type CoachSessionsRequest = z.input<typeof coachSessionsRequest>;
/** What the function works with, after normalization. */
export type CoachSessionsCommand = z.output<typeof coachSessionsRequest>;

export const invitationRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('preview'), token: invitationToken }),
  z.object({
    action: z.literal('join'),
    token: invitationToken,
    displayName: personName,
    consentAccepted,
  }),
]);

export type InvitationRequest = z.input<typeof invitationRequest>;
export type InvitationCommand = z.output<typeof invitationRequest>;

export const sessionSummary = z.object({
  id: z.uuid(),
  title: z.string(),
  studentName: z.string().nullable(),
  scheduledAt: z.string(),
  durationMinutes: z.number().int(),
  status: z.enum(['scheduled', 'ended']),
});
export type SessionSummary = z.infer<typeof sessionSummary>;

export const createSessionResponse = z.object({ session: sessionSummary, inviteUrl: z.url() });
export const inviteLinkResponse = z.object({ inviteUrl: z.url() });

/** Short-lived LiveKit access for one participant in one session's room. */
export const callCredentials = z.object({
  livekitUrl: z.string().min(1),
  token: z.string().min(1),
});
export type CallCredentials = z.infer<typeof callCredentials>;

/** `roomClosed` is false when the session was ended but LiveKit could not be reached. */
export const endSessionResponse = z.object({ ended: z.literal(true), roomClosed: z.boolean() });

export const invitationPreview = z.union([
  z.object({ state: z.literal('invalid') }),
  z.object({
    state: z.enum(['open', 'expired', 'ended']),
    coachName: z.string(),
    title: z.string(),
    scheduledAt: z.string(),
    durationMinutes: z.number().int(),
  }),
]);
export type InvitationPreview = z.infer<typeof invitationPreview>;

export const API_ERROR_CODES = [
  'bad_request',
  'unauthorized',
  'not_found',
  'session_ended',
  'session_expired',
  'server_error',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Error bodies carry a code only: no request echo, no token (NFR-10). */
export const errorResponse = z.object({ error: z.object({ code: z.enum(API_ERROR_CODES) }) });
