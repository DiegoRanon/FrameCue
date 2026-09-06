import Constants from 'expo-constants';

import type { CallRole } from '@/call/roles';

type Extra = {
  livekitUrl?: string;
  livekitCoachToken?: string;
  livekitStudentToken?: string;
  livekitRoom?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Runtime configuration sourced from app.config.ts `extra`.
 *
 * The per-role tokens are a development convenience for M1-M5: two devices
 * need two identities, or the second connection evicts the first. From M6 the
 * backend mints a short-lived token per participant and these are removed.
 */
export const env = {
  livekitUrl: extra.livekitUrl ?? '',
  livekitRoom: extra.livekitRoom ?? 'framecue-dev',
  tokens: {
    coach: extra.livekitCoachToken ?? '',
    student: extra.livekitStudentToken ?? '',
  },
} as const;

export type LivekitConfig = { url: string; token: string; room: string };

export function livekitConfigFor(role: CallRole): LivekitConfig | null {
  const token = env.tokens[role];
  if (!env.livekitUrl || !token) {
    return null;
  }
  return { url: env.livekitUrl, token, room: env.livekitRoom };
}

/** Which pieces are missing, phrased for the setup screen rather than a stack trace. */
export function missingLivekitConfig(role: CallRole): string[] {
  const missing: string[] = [];
  if (!env.livekitUrl) {
    missing.push('LIVEKIT_URL');
  }
  if (!env.tokens[role]) {
    missing.push(role === 'coach' ? 'LIVEKIT_COACH_TOKEN' : 'LIVEKIT_STUDENT_TOKEN');
  }
  return missing;
}

export const isLivekitConfigured = () => Boolean(env.livekitUrl);
