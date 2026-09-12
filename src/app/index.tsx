import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { MessageScreen } from '@/call/components/MessageScreen';
import { isBackendConfigured, missingBackendConfig } from '@/config/env';

/**
 * Entry point for opening the app directly. A student never needs it - their
 * invitation link opens the join screen - so this routes the coach: to the
 * dashboard when signed in, to sign-in otherwise (FR-01).
 */
export default function Home() {
  const auth = useAuth();

  if (!isBackendConfigured()) {
    return (
      <MessageScreen
        title="Not configured yet"
        body="Copy framecue.local.example.json to framecue.local.json, fill in the Supabase project and the invite host, then rebuild the app."
        details={missingBackendConfig().map((name) => `${name} is missing`)}
      />
    );
  }

  if (auth.status === 'loading') {
    return <MessageScreen title="FrameCue" body="Opening…" />;
  }

  return <Redirect href={auth.status === 'signedIn' ? '/dashboard' : '/sign-in'} />;
}
