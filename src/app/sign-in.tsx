import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { describeAuthError } from '@/auth/authErrors';
import { supabase } from '@/backend/supabase';
import { authCallbackUrl } from '@/config/env';
import { colors, spacing } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Passwordless coach sign-in (FR-01). The email carries a link, which returns
 * to the app through the invite host's App Link, and the same one-time code
 * for a coach who opened the email somewhere else.
 */
export default function SignIn() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'signedIn') {
    return <Redirect href="/dashboard" />;
  }

  const sendEmail = (address: string) => {
    if (!EMAIL_PATTERN.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    supabase.auth
      .signInWithOtp({
        email: address,
        options: { emailRedirectTo: authCallbackUrl(), shouldCreateUser: true },
      })
      .then(({ error: sendError }) => {
        if (sendError) {
          setError(describeAuthError(sendError, 'sending'));
          return;
        }
        setSentTo(address);
        setCode('');
      })
      .finally(() => setBusy(false));
  };

  const verifyCode = () => {
    if (!sentTo) {
      return;
    }
    setBusy(true);
    setError(null);
    supabase.auth
      .verifyOtp({ email: sentTo, token: code.trim(), type: 'email' })
      .then(({ error: verifyError }) => {
        if (verifyError) {
          setError(describeAuthError(verifyError, 'verifying'));
          return;
        }
        router.replace('/dashboard');
      })
      .finally(() => setBusy(false));
  };

  if (sentTo) {
    return (
      <Screen
        title="Check your email"
        subtitle={`We sent a sign-in link to ${sentTo}. Tap it on this phone, or type the code from the same email.`}
      >
        <TextField
          label="Code from the email"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={10}
          returnKeyType="done"
          onSubmitEditing={verifyCode}
        />
        {error ? <ErrorText message={error} /> : null}
        <Button
          label="Sign in with code"
          variant="primary"
          busy={busy}
          disabled={code.trim().length < 6}
          onPress={verifyCode}
        />
        <Button label="Send a new email" disabled={busy} onPress={() => sendEmail(sentTo)} />
        <Button
          label="Use a different email"
          disabled={busy}
          onPress={() => {
            setSentTo(null);
            setError(null);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen title="FrameCue" subtitle="Sign in to run your lessons. No password needed.">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => sendEmail(email.trim())}
      />
      {error ? <ErrorText message={error} /> : null}
      <Button
        label="Email me a sign-in link"
        variant="primary"
        busy={busy}
        disabled={!email.trim()}
        onPress={() => sendEmail(email.trim())}
      />
      <View style={styles.studentNote}>
        <Text style={styles.studentNoteText}>
          Joining a lesson as a student? Open the invitation link your coach sent you. You do not
          need an account.
        </Text>
      </View>
    </Screen>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <Text accessibilityLiveRegion="polite" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.warning, fontSize: 15 },
  studentNote: { marginTop: spacing.lg },
  studentNoteText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
