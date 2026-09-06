import { VideoTrack } from '@livekit/react-native';
import type { TrackReference } from '@livekit/components-react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/theme';

const TILE_WIDTH = 104;
const TILE_HEIGHT = 148;

/**
 * Own camera, small. Deliberately top-aligned by the caller: spec section 4.1
 * requires the coach tile not to cover the student's feet or lower body, and
 * a tripod framing puts those at the bottom of the stage.
 */
export function SelfTile({
  trackRef,
  cameraEnabled,
}: {
  trackRef: TrackReference | undefined;
  cameraEnabled: boolean;
}) {
  return (
    <View style={styles.tile} accessible accessibilityLabel="Your camera">
      {trackRef && cameraEnabled ? (
        <VideoTrack trackRef={trackRef} style={styles.video} objectFit="cover" mirror zOrder={1} />
      ) : (
        <Text style={styles.offText}>Camera off</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  offText: { color: colors.textMuted, fontSize: 12 },
  tile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: TILE_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
    width: TILE_WIDTH,
  },
  video: { height: '100%', width: '100%' },
});
