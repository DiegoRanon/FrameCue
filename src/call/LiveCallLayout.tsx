import type { TrackReference } from '@livekit/components-react';
import {
  useConnectionQualityIndicator,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CallControls } from '@/call/components/CallControls';
import { ConnectionPill } from '@/call/components/ConnectionPill';
import { LiveBadge } from '@/call/components/LiveBadge';
import { SelfTile } from '@/call/components/SelfTile';
import { VideoStage } from '@/call/components/VideoStage';
import { describeConnection } from '@/call/connectionStatus';
import { colors, spacing } from '@/theme';

type LiveCallLayoutProps = {
  /** What fills the stage when the other participant has not joined yet. */
  emptyStageMessage: string;
  stageLabel: string;
  onLeave: () => void;
  /**
   * Role-specific area under the stage, given the track on the stage so it can
   * act on it. The coach's replay controls live here.
   */
  footer?: (remoteTrack: TrackReference | undefined) => ReactNode;
};

/**
 * Shared live layout: the other participant fills the stage, own camera sits
 * in a small top-aligned tile, controls sit at the bottom. Both roles use it;
 * what differs between them is the copy and the footer.
 */
export function LiveCallLayout({
  emptyStageMessage,
  stageLabel,
  onLeave,
  footer,
}: LiveCallLayoutProps) {
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();
  // Explicit participant: this component sits outside a participant context,
  // and the hook has no default there.
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });

  const status = describeConnection(connectionState, quality);

  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const remoteTrack = cameraTracks.find((track) => !track.participant.isLocal);
  const localTrack = cameraTracks.find((track) => track.participant.isLocal);

  const toggleMic = useCallback(() => {
    void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [isMicrophoneEnabled, localParticipant]);

  const toggleCamera = useCallback(() => {
    void localParticipant.setCameraEnabled(!isCameraEnabled);
  }, [isCameraEnabled, localParticipant]);

  const leave = useCallback(() => {
    void room.disconnect();
    onLeave();
  }, [onLeave, room]);

  return (
    <View style={styles.root}>
      <View style={styles.stageArea}>
        <VideoStage
          trackRef={remoteTrack}
          emptyMessage={emptyStageMessage}
          accessibilityLabel={stageLabel}
        />

        <View style={[styles.overlayTop, { top: insets.top + spacing.sm }]} pointerEvents="none">
          <View style={styles.badges}>
            <LiveBadge />
            <ConnectionPill status={status} />
          </View>
          <SelfTile trackRef={localTrack} cameraEnabled={isCameraEnabled} />
        </View>
      </View>

      {footer?.(remoteTrack)}

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.sm }]}>
        <CallControls
          micEnabled={isMicrophoneEnabled}
          cameraEnabled={isCameraEnabled}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onLeave={leave}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: { alignItems: 'flex-start', gap: spacing.xs + 2 },
  controls: { backgroundColor: colors.background },
  overlayTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: spacing.md,
    position: 'absolute',
    right: spacing.md,
  },
  root: { backgroundColor: colors.background, flex: 1 },
  stageArea: { flex: 1 },
});
