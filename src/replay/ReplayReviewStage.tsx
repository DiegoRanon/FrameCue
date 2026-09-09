import { VideoView, type VideoPlayer } from 'expo-video';
import { StyleSheet, View } from 'react-native';

/**
 * The prepared replay, filling the stage in place of the live video.
 *
 * `contentFit="contain"` for the same reason the live stage uses it: a phone
 * on a tripod frames the whole body, and cropping cuts off the footwork the
 * coach is trying to correct.
 *
 * Native controls are off - the coach drives playback from the controls below,
 * and in M4 those same commands drive the student's screen too.
 */
export function ReplayReviewStage({ player }: { player: VideoPlayer }) {
  return (
    <View style={styles.stage} accessible accessibilityLabel="Replay">
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: '#000', flex: 1 },
  video: { flex: 1 },
});
