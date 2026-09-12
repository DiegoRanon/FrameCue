import { AudioSession, useTrackVolume, VideoView } from '@livekit/react-native';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { describeApiError } from '@/backend/api';
import { requestCallPermissions } from '@/call/permissions';
import type { CallRole } from '@/call/roles';
import type { FacingMode } from '@/call/roomOptions';
import { ConsentNotice } from '@/precall/ConsentNotice';
import { useDevicePreview } from '@/precall/useDevicePreview';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const TEST_TONE = require('../../assets/sounds/test-tone.wav') as number;

export type PreCallChoice = { facingMode: FacingMode; audioOutput: string | null };

type Permissions =
  { state: 'checking' } | { state: 'granted' } | { state: 'denied'; missing: string[] };

type Connection =
  | { state: 'checking' }
  | { state: 'good' }
  | { state: 'slow' }
  | { state: 'failed'; message: string };

/**
 * Above this, the round trip to the backend is reported as slow. It measures
 * whether FrameCue is reachable, not the media path; the live call reports its
 * own connection quality once it starts (FR-18).
 */
const SLOW_ROUND_TRIP_MS = 1500;

const OUTPUT_LABELS: Record<string, string> = {
  bluetooth: 'Bluetooth',
  default: 'Default',
  earpiece: 'Phone earpiece',
  force_speaker: 'Speaker',
  headset: 'Headphones',
  speaker: 'Speaker',
};

/**
 * Spec section 4 pre-call check, shared by both roles (FR-05): camera preview
 * with framing guidance, microphone level, sound output and a test tone,
 * connection result, and - for the coach - the replay notice.
 */
export function PreCallCheck({
  role,
  heading,
  details,
  checkConnection,
  requireConsent,
  onJoin,
  onBack,
}: {
  role: CallRole;
  heading: string;
  details?: string;
  /** Rejects when the backend is unreachable or the session cannot be joined. */
  checkConnection: () => Promise<void>;
  /** The coach acknowledges here; the student already did on the join screen. */
  requireConsent: boolean;
  onJoin: (choice: PreCallChoice) => void;
  onBack: () => void;
}) {
  const [permissions, setPermissions] = useState<Permissions>({ state: 'checking' });
  const [permissionAttempt, setPermissionAttempt] = useState(0);
  const [connection, setConnection] = useState<Connection>({ state: 'checking' });
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const [outputs, setOutputs] = useState<string[]>([]);
  const [audioOutput, setAudioOutput] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const granted = permissions.state === 'granted';
  const preview = useDevicePreview(granted, facingMode);
  const micVolume = useTrackVolume(preview.audio ?? undefined);
  const tone = useVideoPlayer(TEST_TONE, (player) => {
    player.loop = false;
  });

  useEffect(() => {
    let cancelled = false;
    void requestCallPermissions().then((result) => {
      if (!cancelled) {
        setPermissions(
          result.granted ? { state: 'granted' } : { state: 'denied', missing: result.missing },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [permissionAttempt]);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    checkConnection()
      .then(() => {
        if (!cancelled) {
          const slow = Date.now() - startedAt >= SLOW_ROUND_TRIP_MS;
          setConnection({ state: slow ? 'slow' : 'good' });
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setConnection({ state: 'failed', message: describeApiError(caught) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [checkConnection, connectionAttempt]);

  useEffect(() => {
    if (!granted) {
      return;
    }
    let cancelled = false;
    // Output routes are only reported once an audio session is running.
    AudioSession.startAudioSession()
      .then(() => AudioSession.getAudioOutputs())
      .then((available) => {
        if (!cancelled) {
          setOutputs(available);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void AudioSession.stopAudioSession();
    };
  }, [granted]);

  const retryPermissions = useCallback(() => {
    setPermissions({ state: 'checking' });
    setPermissionAttempt((value) => value + 1);
  }, []);

  const retryConnection = useCallback(() => {
    setConnection({ state: 'checking' });
    setConnectionAttempt((value) => value + 1);
  }, []);

  const selectOutput = useCallback((output: string) => {
    setAudioOutput(output);
    AudioSession.selectAudioOutput(output).catch(() => undefined);
  }, []);

  const playTone = () => {
    tone.replay();
    tone.play();
  };

  const join = () => {
    // Release the camera and microphone before the call opens them itself.
    preview.video?.stop();
    preview.audio?.stop();
    onJoin({ facingMode, audioOutput });
  };

  const connected = connection.state === 'good' || connection.state === 'slow';
  const canJoin = granted && connected && (!requireConsent || consent);
  // Speech sits well below full scale, so the meter is amplified to be readable.
  const level = Math.min(1, micVolume * 3);

  return (
    <Screen title={heading} subtitle={details}>
      <Section title="Camera">
        {permissions.state === 'denied' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              A lesson needs the camera and the microphone. {permissions.missing.join(' and ')}{' '}
              access was denied. Allow it, or turn it on in system settings if the prompt no longer
              appears.
            </Text>
            <Button label="Allow access" variant="primary" onPress={retryPermissions} />
          </View>
        ) : (
          <View style={styles.preview} accessible accessibilityLabel="Your camera preview">
            {preview.video ? (
              <VideoView
                videoTrack={preview.video}
                style={styles.video}
                objectFit="cover"
                mirror={facingMode === 'user'}
              />
            ) : null}
            {role === 'student' ? <View pointerEvents="none" style={styles.frameGuide} /> : null}
            <Text style={styles.guideText}>{framingGuidance(role)}</Text>
          </View>
        )}
        {preview.error ? <Text style={styles.warning}>{preview.error}</Text> : null}
        <Button
          label={facingMode === 'user' ? 'Use back camera' : 'Use front camera'}
          disabled={!granted}
          onPress={() => setFacingMode((mode) => (mode === 'user' ? 'environment' : 'user'))}
        />
      </Section>

      <Section title="Microphone">
        <View
          style={styles.meterTrack}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Microphone level"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(level * 100) }}
        >
          <View style={[styles.meterFill, { width: `${Math.round(level * 100)}%` }]} />
        </View>
        <Text style={styles.hint}>Say something. The bar should move.</Text>
      </Section>

      <Section title="Sound">
        {outputs.length > 1 ? (
          <View style={styles.chips} accessibilityRole="radiogroup">
            {outputs.map((output) => (
              <Chip
                key={output}
                label={OUTPUT_LABELS[output] ?? output}
                selected={audioOutput === output}
                onPress={() => selectOutput(output)}
              />
            ))}
          </View>
        ) : null}
        <Button label="Play test sound" onPress={playTone} />
        <Text style={styles.hint}>You should hear a short tone.</Text>
      </Section>

      <Section title="Connection">
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.connection, connection.state === 'failed' && styles.warning]}
        >
          {describeConnection(connection)}
        </Text>
        {connection.state === 'failed' ? (
          <Button label="Check again" onPress={retryConnection} />
        ) : null}
      </Section>

      {requireConsent ? <ConsentNotice accepted={consent} onChange={setConsent} /> : null}

      <View style={styles.actions}>
        <Button label="Join session" variant="primary" disabled={!canJoin} onPress={join} />
        <Button label="Back" onPress={onBack} />
      </View>
    </Screen>
  );
}

function framingGuidance(role: CallRole): string {
  // Spec section 10: a student out of frame is a high-severity risk for the
  // whole replay feature, so the student gets the full-body guide.
  return role === 'student'
    ? 'Stand back until your whole body, head to feet, fits inside the frame.'
    : 'Keep your face in view so your student can see you.';
}

function describeConnection(connection: Connection): string {
  switch (connection.state) {
    case 'checking':
      return 'Checking the connection…';
    case 'good':
      return 'Connected to FrameCue.';
    case 'slow':
      return 'Connected, but the connection is slow. The call may be less smooth.';
    case 'failed':
      return connection.message;
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET - 8,
    paddingHorizontal: spacing.md,
  },
  chipSelected: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  connection: { color: colors.text, fontSize: 15 },
  frameGuide: {
    borderColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    borderWidth: 2,
    bottom: '16%',
    left: '24%',
    position: 'absolute',
    right: '24%',
    top: '5%',
  },
  guideText: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    bottom: 0,
    color: colors.text,
    fontSize: 14,
    left: 0,
    padding: spacing.sm,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
  hint: { color: colors.textMuted, fontSize: 13 },
  meterFill: { backgroundColor: colors.good, height: '100%' },
  meterTrack: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    height: 16,
    overflow: 'hidden',
  },
  notice: { gap: spacing.sm },
  noticeText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  preview: {
    backgroundColor: '#000',
    borderRadius: radius.md,
    height: 380,
    overflow: 'hidden',
  },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  video: { flex: 1 },
  warning: { color: colors.warning, fontSize: 14 },
});
