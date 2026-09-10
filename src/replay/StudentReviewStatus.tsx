import { useEventListener } from 'expo';
import type { VideoPlayer } from 'expo-video';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatSeconds } from '@/replay/ReplayReviewControls';
import type { ReplayRate } from '@/replay/playerCommands';
import { colors, radius, spacing } from '@/theme';

/**
 * What the student sees underneath a replay: the playback position, and a plain
 * statement of who is driving it.
 *
 * Deliberately not controls. Spec section 3.1.7 gives the student visibility
 * without control, and section 4.2 requires that the student can see the coach
 * is the one in charge - otherwise a paused replay reads as a frozen screen.
 */
export function StudentReviewStatus({
  player,
  requestedSeconds,
}: {
  player: VideoPlayer;
  requestedSeconds: number | null;
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState<ReplayRate>(1);

  useEventListener(player, 'timeUpdate', (payload) => setCurrentTime(payload.currentTime));
  useEventListener(player, 'playingChange', (payload) => setIsPlaying(payload.isPlaying));
  useEventListener(player, 'playbackRateChange', (payload) =>
    setRate(payload.playbackRate === 0.5 ? 0.5 : 1),
  );

  // The player reports 0 until the clip has loaded; the coach's requested
  // duration is a good enough scale until then.
  const duration = player.duration > 0 ? player.duration : (requestedSeconds ?? 0);
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const state = `${isPlaying ? 'Playing' : 'Paused'}${rate === 0.5 ? ' at half speed' : ''}`;

  return (
    <View
      style={styles.panel}
      accessible
      accessibilityLabel={`${state}. ${formatSeconds(currentTime)} of ${formatSeconds(duration)}. Your coach controls playback.`}
    >
      <View style={styles.row}>
        <Text style={styles.state}>{state}</Text>
        <Text style={styles.time}>
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
        </Text>
      </View>

      <View style={styles.trackBase} accessibilityElementsHidden importantForAccessibility="no">
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.note}>Your coach controls playback</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.textMuted, fontSize: 14 },
  panel: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  state: { color: colors.text, fontSize: 16, fontWeight: '600' },
  time: { color: colors.textMuted, fontSize: 13 },
  trackBase: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  trackFill: { backgroundColor: colors.accent, height: 6 },
});
