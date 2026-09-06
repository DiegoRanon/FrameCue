import { VideoTrack } from '@livekit/react-native';
import type { TrackReference } from '@livekit/components-react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

/**
 * The dominant view. objectFit is 'contain' so the camera aspect ratio is
 * preserved rather than cropped (spec section 4.1) - cropping a phone on a
 * tripod is what cuts off the feet the coach needs to see.
 */
export function VideoStage({
  trackRef,
  emptyMessage,
  accessibilityLabel,
}: {
  trackRef: TrackReference | undefined;
  emptyMessage: string;
  accessibilityLabel: string;
}) {
  if (!trackRef) {
    return (
      <View style={[styles.stage, styles.empty]}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.stage} accessible accessibilityLabel={accessibilityLabel}>
      <VideoTrack trackRef={trackRef} style={styles.video} objectFit="contain" zOrder={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: 16, textAlign: 'center' },
  stage: { backgroundColor: '#000', flex: 1 },
  video: { flex: 1 },
});
