import { inspectClip, type ClipInspection } from '@modules/replay-buffer';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReplayBufferState } from '@/replay/useReplayBuffer';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

/**
 * Milestone 2 instrumentation, coach side only.
 *
 * It shows what the buffer is doing and lets a clip be prepared, which is what
 * the spike has to demonstrate. The real Replay Ready card - with Show Replay,
 * Replace, and Discard - is M3; this panel is replaced by it, not extended.
 */
export function ReplayBufferPanel({ state }: { state: ReplayBufferState }) {
  const { status, clip, error, canPrepare15, canPrepare30 } = state;
  const [inspection, setInspection] = useState<ClipInspection | null>(null);

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Text style={styles.metric}>
          {status.buffering ? `${status.availableSeconds.toFixed(0)}s buffered` : 'Not buffering'}
        </Text>
        <Text style={styles.detail}>
          {status.width > 0 ? `${status.width}x${status.height}` : '-'} ·{' '}
          {(status.bytes / 1024 / 1024).toFixed(1)} MB · {status.droppedFrames} dropped
        </Text>
      </View>

      <View style={styles.actions}>
        <PrepareButton
          label="Prepare 15s"
          enabled={canPrepare15}
          countdown={PREPARE_COUNTDOWN(status.availableSeconds, 15)}
          onPress={() => void state.prepare(15)}
        />
        <PrepareButton
          label="Prepare 30s"
          enabled={canPrepare30}
          countdown={PREPARE_COUNTDOWN(status.availableSeconds, 30)}
          onPress={() => void state.prepare(30)}
        />
      </View>

      {clip ? (
        <View style={styles.row}>
          <Text style={styles.ready}>
            Clip ready: {clip.durationSeconds.toFixed(1)}s ({clip.requestedSeconds}s asked),{' '}
            {(clip.sizeBytes / 1024).toFixed(0)} KB
          </Text>
          <View style={styles.clipActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Verify prepared replay"
              onPress={() => void inspectClip(clip.path).then(setInspection)}
            >
              <Text style={styles.verify}>Verify</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Discard prepared replay"
              onPress={() => {
                setInspection(null);
                void state.discard();
              }}
            >
              <Text style={styles.discard}>Discard</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {inspection ? (
        <Text style={styles.ready}>
          Decoded: {String(inspection.decodedFrame)} · {inspection.width}x{inspection.height} ·{' '}
          {inspection.durationMs}ms · rot {inspection.rotation} · {inspection.frameCount} frames
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Seconds still needed, or null when the button is already available (spec 3.2). */
function PREPARE_COUNTDOWN(available: number, required: number): number | null {
  const remaining = Math.ceil(required - available);
  return remaining > 0 ? remaining : null;
}

function PrepareButton({
  label,
  enabled,
  countdown,
  onPress,
}: {
  label: string;
  enabled: boolean;
  countdown: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        !enabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
      {!enabled && countdown !== null ? (
        <Text style={styles.buttonHint}>{countdown}s more</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonHint: { color: colors.textMuted, fontSize: 11 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  clipActions: { flexDirection: 'row', gap: spacing.md },
  detail: { color: colors.textMuted, fontSize: 12 },
  discard: { color: colors.warning, fontSize: 13, fontWeight: '600' },
  error: { color: colors.bad, fontSize: 12 },
  metric: { color: colors.text, fontSize: 14, fontWeight: '600' },
  panel: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  ready: { color: colors.good, flexShrink: 1, fontSize: 13 },
  verify: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
