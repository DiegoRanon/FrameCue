import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClipDelivery } from '@/replay/useClipDelivery';
import type { PendingReplayControls } from '@/replay/usePendingReplay';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

/**
 * The coach's replay controls while the call is live (spec section 4).
 *
 * Three states in one strip: the prepare buttons, the Replay Ready card once
 * something is pending, and the replacement confirmation. All coach-only - the
 * student's screen never changes because of anything here (FR-10).
 */
export function ReplayControls({
  replay,
  delivery,
}: {
  replay: PendingReplayControls;
  delivery: ClipDelivery;
}) {
  const preparing = replay.phase === 'preparing';

  return (
    <View style={styles.panel}>
      {replay.phase === 'confirmingReplace' ? (
        <ReplaceConfirmation replay={replay} />
      ) : (
        <>
          {replay.clip ? <ReplayReadyCard replay={replay} delivery={delivery} /> : null}
          <View style={styles.prepareRow}>
            <PrepareButton
              label="Prepare 15s"
              enabled={replay.canPrepare15}
              countdown={replay.countdown15}
              busy={preparing}
              onPress={() => replay.prepare(15)}
            />
            <PrepareButton
              label="Prepare 30s"
              enabled={replay.canPrepare30}
              countdown={replay.countdown30}
              busy={preparing}
              onPress={() => replay.prepare(30)}
            />
          </View>
        </>
      )}

      {replay.error ? <Text style={styles.error}>{replay.error}</Text> : null}
    </View>
  );
}

/**
 * Spec section 4: coach-only card with the replay's duration, Show Replay,
 * Replace, and Discard.
 *
 * The transfer to the student runs underneath this card (D-001). It is reported
 * but never waited on: a replay whose clip is still in flight can still be
 * shown, because the student's screen covers that case. Only an outright
 * failure holds Show Replay back, and then with a retry (section 3.2).
 */
function ReplayReadyCard({
  replay,
  delivery,
}: {
  replay: PendingReplayControls;
  delivery: ClipDelivery;
}) {
  const clip = replay.clip;
  if (!clip) {
    return null;
  }

  const failed = delivery.phase === 'failed';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.readyDot, failed && styles.readyDotFailed]} />
        <Text style={styles.cardTitle}>Replay ready</Text>
        <Text style={styles.cardDuration}>last {clip.requestedSeconds} seconds</Text>
      </View>

      <DeliveryStatus delivery={delivery} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show replay"
        accessibilityHint="Shows the prepared replay on both screens"
        accessibilityState={{ disabled: failed }}
        disabled={failed}
        onPress={replay.show}
        style={({ pressed }) => [
          styles.showButton,
          failed && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.showButtonText}>Show Replay</Text>
      </Pressable>

      <View style={styles.secondaryRow}>
        {failed ? <ConfirmButton label="Retry sending" onPress={delivery.retry} /> : null}
        <SecondaryButton label="Replace" onPress={replay.replace} />
        <SecondaryButton label="Discard" tone="warning" onPress={replay.discard} />
      </View>
    </View>
  );
}

/**
 * One line of plain language, never a technical one (spec section 4.1: the
 * interface shows connection quality without jargon, and the same applies
 * here). No byte counts, no filenames.
 */
function DeliveryStatus({ delivery }: { delivery: ClipDelivery }) {
  switch (delivery.phase) {
    case 'waitingForStudent':
      return <Text style={styles.deliveryNote}>Will send when the student joins</Text>;
    case 'sending':
      return (
        <Text style={styles.deliveryNote}>
          Sending to the student {Math.round(delivery.progress * 100)}%
        </Text>
      );
    case 'delivered':
      return <Text style={styles.deliveryNote}>Ready on the student&apos;s device</Text>;
    case 'failed':
      return (
        <Text style={styles.deliveryFailed}>
          The replay could not be sent to the student. The session is unaffected.
        </Text>
      );
    default:
      return null;
  }
}

/**
 * Section 5.1: replacing a pending replay is confirmed first, so a mistimed
 * tap cannot throw away the moment the coach was waiting to show.
 */
function ReplaceConfirmation({ replay }: { replay: PendingReplayControls }) {
  const chosen = replay.pendingSeconds;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {chosen
          ? `Replace the pending replay with the last ${chosen} seconds?`
          : 'Replace the pending replay with:'}
      </Text>
      <Text style={styles.confirmHint}>The current replay will be discarded.</Text>

      {chosen ? (
        <View style={styles.secondaryRow}>
          <ConfirmButton label="Replace" onPress={() => replay.confirmReplace()} />
          <SecondaryButton label="Keep current" onPress={replay.cancelReplace} />
        </View>
      ) : (
        <View style={styles.secondaryRow}>
          <ConfirmButton
            label="Last 15s"
            disabled={!replay.canPrepare15}
            onPress={() => replay.confirmReplace(15)}
          />
          <ConfirmButton
            label="Last 30s"
            disabled={!replay.canPrepare30}
            onPress={() => replay.confirmReplace(30)}
          />
          <SecondaryButton label="Cancel" onPress={replay.cancelReplace} />
        </View>
      )}
    </View>
  );
}

function PrepareButton({
  label,
  enabled,
  countdown,
  busy,
  onPress,
}: {
  label: string;
  enabled: boolean;
  countdown: number | null;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled, busy }}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.prepareButton,
        !enabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.prepareLabel}>{label}</Text>
      {busy ? (
        <Text style={styles.prepareHint}>Preparing</Text>
      ) : !enabled && countdown !== null ? (
        <Text style={styles.prepareHint}>{countdown}s more</Text>
      ) : null}
    </Pressable>
  );
}

function ConfirmButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.confirmButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.confirmButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone?: 'warning';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
    >
      <Text style={[styles.secondaryText, tone === 'warning' && styles.secondaryWarning]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardDuration: { color: colors.textMuted, fontSize: 14 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs + 2 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  deliveryFailed: { color: colors.warning, fontSize: 13 },
  deliveryNote: { color: colors.textMuted, fontSize: 13 },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
  },
  confirmButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  confirmHint: { color: colors.textMuted, fontSize: 13 },
  disabled: { opacity: 0.45 },
  error: { color: colors.bad, fontSize: 13 },
  panel: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  prepareButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
  },
  prepareHint: { color: colors.textMuted, fontSize: 11 },
  prepareLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  prepareRow: { flexDirection: 'row', gap: spacing.sm },
  pressed: { opacity: 0.8 },
  readyDot: { backgroundColor: colors.good, borderRadius: radius.pill, height: 10, width: 10 },
  readyDotFailed: { backgroundColor: colors.warning },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
  },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  secondaryWarning: { color: colors.warning },
  showButton: {
    alignItems: 'center',
    backgroundColor: colors.good,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
  },
  showButtonText: { color: '#06210F', fontSize: 17, fontWeight: '700' },
});
