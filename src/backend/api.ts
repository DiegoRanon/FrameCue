import { FunctionsHttpError } from '@supabase/supabase-js';
import type { z } from 'zod';

import { supabase } from '@/backend/supabase';
import {
  callCredentials,
  createSessionResponse,
  endSessionResponse,
  errorResponse,
  invitationPreview,
  inviteLinkResponse,
  type ApiErrorCode,
  type CoachSessionsRequest,
  type InvitationRequest,
} from '@shared/contract';

/** `network` means no answer arrived at all. */
export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode | 'network') {
    super(code);
    this.name = 'ApiError';
  }
}

type FunctionName = 'coach-sessions' | 'invitation';

async function invoke<Schema extends z.ZodType>(
  name: FunctionName,
  body: CoachSessionsRequest | InvitationRequest,
  schema: Schema,
): Promise<z.output<Schema>> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    throw await toApiError(error);
  }
  // The response is validated like any other input: a mismatch is a server
  // error, not a crash somewhere further down.
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('server_error');
  }
  return parsed.data;
}

async function toApiError(error: unknown): Promise<ApiError> {
  if (!(error instanceof FunctionsHttpError)) {
    return new ApiError('network');
  }
  try {
    const parsed = errorResponse.safeParse(await (error.context as Response).json());
    return new ApiError(parsed.success ? parsed.data.error.code : 'server_error');
  } catch {
    return new ApiError('server_error');
  }
}

type CreateSessionInput = Omit<Extract<CoachSessionsRequest, { action: 'create' }>, 'action'>;

/** A signed-in coach's session actions. The access token is attached by the client. */
export const coachSessions = {
  create: (input: CreateSessionInput) =>
    invoke('coach-sessions', { action: 'create', ...input }, createSessionResponse),
  inviteLink: (sessionId: string) =>
    invoke('coach-sessions', { action: 'inviteLink', sessionId }, inviteLinkResponse),
  /** Only called after the coach has acknowledged the replay notice (FR-04). */
  join: (sessionId: string, consent: { consentAccepted: true }) =>
    invoke('coach-sessions', { action: 'join', sessionId, ...consent }, callCredentials),
  end: (sessionId: string) =>
    invoke('coach-sessions', { action: 'end', sessionId }, endSessionResponse),
};

/** A student's invitation actions. No account; the token is the credential. */
export const invitations = {
  preview: (token: string) => invoke('invitation', { action: 'preview', token }, invitationPreview),
  /** Only called after the student has acknowledged the replay notice (FR-04). */
  join: (token: string, input: { displayName: string; consentAccepted: true }) =>
    invoke('invitation', { action: 'join', token, ...input }, callCredentials),
};

/** Plain language for every backend failure a screen can show (FR-18). */
export function describeApiError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'server_error';
  switch (code) {
    case 'network':
      return 'FrameCue could not be reached. Check the internet connection and try again.';
    case 'unauthorized':
      return 'You have been signed out. Sign in again to continue.';
    case 'not_found':
      return 'This session could not be found.';
    case 'session_ended':
      return 'This session has ended.';
    case 'session_expired':
      return 'This session is over and can no longer be joined.';
    case 'bad_request':
      return 'Some of the details were not accepted. Check them and try again.';
    default:
      return 'Something went wrong on our side. Try again in a moment.';
  }
}
