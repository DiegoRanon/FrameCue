import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError, describeApiError, invitations } from '@/backend/api';
import { CallScreen } from '@/call/CallScreen';
import { MessageScreen } from '@/call/components/MessageScreen';
import { SessionEndedScreen } from '@/call/components/SessionEndedScreen';
import { ConsentNotice } from '@/precall/ConsentNotice';
import { PreCallCheck, type PreCallChoice } from '@/precall/PreCallCheck';
import { describeSchedule } from '@/sessions/schedule';
import type { InvitationPreview } from '@shared/contract';
import {
  INVITATION_TOKEN_PATTERN,
  normalizePersonName,
  PERSON_NAME_MAX_LENGTH,
} from '@shared/policy';
import { colors, radius, spacing } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';

type Phase =
  | { name: 'details' }
  | { name: 'check' }
  | { name: 'call'; choice: PreCallChoice }
  | { name: 'left' }
  | { name: 'ended' };

type Loaded = { token: string; preview: InvitationPreview } | { token: string; error: string };

/**
 * Where an invitation link opens (FR-03): https://<invite host>/join/<token>.
 * The student sees who the lesson is with, gives a display name, acknowledges
 * the replay notice (FR-04), checks their devices (FR-05), and joins - with no
 * account at any point (AC-02).
 */
export default function JoinSession() {
  const params = useLocalSearchParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const wellFormed = INVITATION_TOKEN_PATTERN.test(token);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>({ name: 'details' });
  const [displayName, setDisplayName] = useState('');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!wellFormed) {
      return;
    }
    let cancelled = false;
    invitations
      .preview(token)
      .then((preview) => {
        if (!cancelled) {
          setLoaded({ token, preview });
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setLoaded({ token, error: describeApiError(caught) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, token, wellFormed]);

  const checkConnection = useCallback(async () => {
    const preview = await invitations.preview(token);
    if (preview.state === 'invalid') {
      throw new ApiError('not_found');
    }
    if (preview.state === 'ended') {
      throw new ApiError('session_ended');
    }
    if (preview.state === 'expired') {
      throw new ApiError('session_expired');
    }
  }, [token]);

  const name = normalizePersonName(displayName);

  const fetchCredentials = useCallback(
    () => invitations.join(token, { displayName: name, consentAccepted: true }),
    [name, token],
  );

  const showEnded = useCallback(() => setPhase({ name: 'ended' }), []);
  const close = useCallback(() => router.replace('/'), []);
  const leave = useCallback(() => setPhase({ name: 'left' }), []);

  // A link opened from a different message replaces this screen's params.
  const current = loaded?.token === token ? loaded : null;

  if (!wellFormed || (current && 'preview' in current && current.preview.state === 'invalid')) {
    return (
      <MessageScreen
        title="This invitation link does not work"
        body="It may be incomplete. Ask your coach to send the link again."
        primaryAction={{ label: 'Close', onPress: close }}
      />
    );
  }

  if (!current) {
    return <MessageScreen title="Opening your invitation" body="One moment…" />;
  }

  if ('error' in current) {
    return (
      <MessageScreen
        title="Could not open the invitation"
        body={current.error}
        primaryAction={{
          label: 'Try again',
          onPress: () => {
            setLoaded(null);
            setAttempt((value) => value + 1);
          },
        }}
        secondaryAction={{ label: 'Close', onPress: close }}
      />
    );
  }

  const { preview } = current;
  if (preview.state === 'invalid') {
    return null;
  }

  if (phase.name === 'ended' || preview.state === 'ended') {
    return <SessionEndedScreen actionLabel="Close" onDone={close} />;
  }

  if (preview.state === 'expired') {
    return (
      <MessageScreen
        title="This invitation has expired"
        body="The session is over. If you still have a lesson to join, ask your coach for a new link."
        primaryAction={{ label: 'Close', onPress: close }}
      />
    );
  }

  const schedule = describeSchedule(new Date(preview.scheduledAt), preview.durationMinutes);

  if (phase.name === 'left') {
    return (
      <MessageScreen
        title="You left the session"
        body="You can rejoin while the session is still running."
        primaryAction={{ label: 'Rejoin', onPress: () => setPhase({ name: 'check' }) }}
        secondaryAction={{ label: 'Close', onPress: close }}
      />
    );
  }

  if (phase.name === 'call') {
    return (
      <CallScreen
        role="student"
        fetchCredentials={fetchCredentials}
        facingMode={phase.choice.facingMode}
        audioOutput={phase.choice.audioOutput}
        onEnded={showEnded}
        onExit={leave}
      />
    );
  }

  if (phase.name === 'check') {
    return (
      <PreCallCheck
        role="student"
        heading={preview.title}
        details={`With ${preview.coachName} · ${schedule}`}
        checkConnection={checkConnection}
        requireConsent={false}
        onJoin={(choice) => setPhase({ name: 'call', choice })}
        onBack={() => setPhase({ name: 'details' })}
      />
    );
  }

  return (
    <Screen title={preview.title} subtitle={`With ${preview.coachName}`}>
      <View style={styles.schedule}>
        <Text style={styles.scheduleText}>{schedule}</Text>
      </View>
      <TextField
        label="Your name"
        hint="Your coach sees this name during the lesson. You do not need an account."
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={PERSON_NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
      <ConsentNotice accepted={consent} onChange={setConsent} />
      <Button
        label="Continue to device check"
        variant="primary"
        disabled={!name || !consent}
        onPress={() => setPhase({ name: 'check' })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  schedule: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  scheduleText: { color: colors.text, fontSize: 16 },
});
