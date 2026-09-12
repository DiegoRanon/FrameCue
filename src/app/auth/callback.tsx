import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/backend/supabase';
import { MessageScreen } from '@/call/components/MessageScreen';

/**
 * Where a tapped sign-in link lands: https://<invite host>/auth/callback?code=…
 * arrives here through the App Link. The code is exchanged using the PKCE
 * verifier stored when the email was requested, which is why the link only
 * works on the phone that asked for it - hence the code fallback.
 */
export default function AuthCallback() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = typeof params.code === 'string' && params.code ? params.code : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!code) {
      return;
    }
    let cancelled = false;
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (cancelled) {
        return;
      }
      if (error) {
        setFailed(true);
      } else {
        router.replace('/dashboard');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Already signed in - with the code, or on an earlier tap of the same link.
  if (auth.status === 'signedIn') {
    return <Redirect href="/dashboard" />;
  }

  if (!code || failed) {
    return (
      <MessageScreen
        title="That sign-in link did not work"
        body="A link works once, for an hour, and only on the phone that asked for it. Type the code from the same email instead, or send a new one."
        primaryAction={{ label: 'Back to sign-in', onPress: () => router.replace('/sign-in') }}
      />
    );
  }

  return <MessageScreen title="Signing you in" body="One moment…" />;
}
