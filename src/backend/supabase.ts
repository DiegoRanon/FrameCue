import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@/backend/database.types';
import { env } from '@/config/env';

/**
 * The app's one Supabase client. It holds only the coach's auth session; a
 * student never signs in.
 *
 * PKCE, because a sign-in link returns through an App Link rather than a web
 * page, and the code verifier never leaves the phone that asked for the link.
 * The placeholders keep `createClient` from throwing on an unconfigured build,
 * so the app can show its setup screen instead of crashing.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl || 'https://not-configured.invalid',
  env.supabasePublishableKey || 'not-configured',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  },
);

// Supabase's React Native guidance: refresh the session only while the app is
// in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
