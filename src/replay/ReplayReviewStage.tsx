import { VideoView, type VideoPlayer } from 'expo-video';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

/**
 * The prepared replay, filling the stage in place of the live video.
 *
 * `contentFit="contain"` for the same reason the live stage uses it: a phone
 * on a tripod frames the whole body, and cropping cuts off the footwork the
 * coach is trying to correct.
 *
 * Native controls are off on both devices: the coach drives playback, and the
 * student's player follows the same commands over the data channel. A student
 * who could scrub would immediately disagree with the coach's screen.
 *
 * `overlayMessage` covers the stage while the student is still waiting for the
 * clip to finish arriving - the one case where Show Replay lands before the
 * transfer does.
 */
export function ReplayReviewStage({
  player,
  overlayMessage = null,
}: {
  player: VideoPlayer;
  overlayMessage?: string | null;
}) {
  return (
    <View style={styles.stage} accessible accessibilityLabel="Replay">
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />
      {overlayMessage ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{overlayMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: '#000',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayText: { color: colors.textMuted, fontSize: 16, textAlign: 'center' },
  stage: { backgroundColor: '#000', flex: 1 },
  video: { flex: 1 },
});
