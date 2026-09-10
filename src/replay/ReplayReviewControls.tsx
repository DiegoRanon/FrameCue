import type { PreparedClip } from '@modules/replay-buffer';
import { useEventListener } from 'expo';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { ReplayCommand, ReplayRate } from '@/replay/playerCommands';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

type ReplayReviewControlsProps = {
  player: VideoPlayer;
  clip: PreparedClip;
  /**
   * Commands go out through the caller rather than straight to the player, so
   * the same press that moves the coach's playback also moves the student's
   * (AC-09). The panel stays unaware of the data channel.
   */
  onCommand: (command: ReplayCommand) => void;
  onReturnToLive: () => void;
};

/**
 * Playback controls for the coach during review (FR-11, spec section 4).
 *
 * Live microphones are untouched by everything here - the coach talks over the
 * replay, which is the point of the whole feature (FR-12).
 */
export function ReplayReviewControls({
  player,
  clip,
  onCommand,
  onReturnToLive,
}: ReplayReviewControlsProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  // Playback state is held here rather than read straight from events, so a
  // seek made while paused moves the timeline immediately: the player only
  // emits time updates while it is actually playing.
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState<ReplayRate>(1);

  useEventListener(player, 'timeUpdate', (payload) => setCurrentTime(payload.currentTime));
  useEventListener(player, 'playingChange', (payload) => setIsPlaying(payload.isPlaying));
  useEventListener(player, 'playbackRateChange', (payload) =>
    setRate(payload.playbackRate === 0.5 ? 0.5 : 1),
  );

  // The duration measured when the clip was written is authoritative; the
  // player reports 0 until the source finishes loading.
  const duration = clip.durationSeconds > 0 ? clip.durationSeconds : player.duration;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const seekToTouch = useCallback(
    (x: number) => {
      if (trackWidth <= 0 || duration <= 0) {
        return;
      }
      const fraction = Math.min(Math.max(x / trackWidth, 0), 1);
      const seconds = fraction * duration;
      setCurrentTime(seconds);
      onCommand({ type: 'seek', seconds });
    },
    [duration, onCommand, trackWidth],
  );

  const togglePlayback = useCallback(() => {
    if (!isPlaying && currentTime >= duration - 0.15) {
      setCurrentTime(0);
    }
    onCommand({ type: isPlaying ? 'pause' : 'play' });
  }, [currentTime, duration, isPlaying, onCommand]);

  const restart = useCallback(() => {
    setCurrentTime(0);
    onCommand({ type: 'restart' });
  }, [onCommand]);

  const toggleRate = useCallback(() => {
    const next: ReplayRate = rate === 1 ? 0.5 : 1;
    setRate(next);
    onCommand({ type: 'rate', rate: next });
  }, [onCommand, rate]);

  return (
    <View style={styles.panel}>
      <View style={styles.timelineRow}>
        <Text style={styles.time}>{formatSeconds(currentTime)}</Text>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="Replay position"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          onLayout={onTrackLayout}
          onPress={(event) => seekToTouch(event.nativeEvent.locationX)}
          style={styles.track}
        >
          <View style={styles.trackBase} />
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        </Pressable>
        <Text style={styles.time}>{formatSeconds(duration)}</Text>
      </View>

      <View style={styles.buttonRow}>
        <ControlButton
          label={isPlaying ? 'Pause' : 'Play'}
          hint="Play or pause the replay"
          onPress={togglePlayback}
        />
        <ControlButton
          label={rate === 1 ? '0.5x' : '1x'}
          hint={rate === 1 ? 'Play at half speed' : 'Play at normal speed'}
          active={rate !== 1}
          onPress={toggleRate}
        />
        <ControlButton label="Restart" hint="Play from the first frame" onPress={restart} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Return to live"
        accessibilityHint="Ends review and returns to the live session"
        onPress={onReturnToLive}
        style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
      >
        <Text style={styles.returnText}>Return to Live</Text>
      </Pressable>
    </View>
  );
}

function ControlButton({
  label,
  hint,
  onPress,
  active = false,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        active && styles.controlButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

/** m:ss - replays are half a minute at most, so no hours. */
export function formatSeconds(value: number): string {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  controlButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
  },
  controlButtonActive: { backgroundColor: colors.accent },
  controlText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  panel: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  pressed: { opacity: 0.8 },
  returnButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
  },
  returnText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  time: { color: colors.textMuted, fontSize: 13, minWidth: 38 },
  timelineRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  track: { flex: 1, justifyContent: 'center', paddingVertical: spacing.sm },
  trackBase: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 6,
    width: '100%',
  },
  trackFill: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 6,
    position: 'absolute',
    left: 0,
  },
});
