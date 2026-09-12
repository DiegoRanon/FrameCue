import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  inviteHost?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Runtime configuration sourced from app.config.ts `extra`, embedded at build
 * time (D-010). Nothing here is secret, and LiveKit is not configured on the
 * device at all: the backend issues short-lived credentials per participant.
 */
export const env = {
  supabaseUrl: extra.supabaseUrl ?? '',
  supabasePublishableKey: extra.supabasePublishableKey ?? '',
  inviteHost: extra.inviteHost ?? '',
} as const;

/** Which pieces are missing, named as they appear in framecue.local.json. */
export function missingBackendConfig(): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) {
    missing.push('supabaseUrl');
  }
  if (!env.supabasePublishableKey) {
    missing.push('supabasePublishableKey');
  }
  if (!env.inviteHost) {
    missing.push('inviteHost');
  }
  return missing;
}

export const isBackendConfigured = () => missingBackendConfig().length === 0;

/**
 * Where a sign-in link returns the coach: a path on the invite host, which the
 * Android App Link hands straight to the app.
 */
export function authCallbackUrl(): string {
  return `https://${env.inviteHost}/auth/callback`;
}
