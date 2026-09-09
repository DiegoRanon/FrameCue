import {
  useConnectionQualityIndicator,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
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
import { useCallTracks } from '@/call/useCallTracks';
import { colors, spacing } from '@/theme';

type LiveCallLayoutProps = {
  /** What fills the stage when the other participant has not joined yet. */
  emptyStageMessage: string;
  stageLabel: string;
  onLeave: () => void;
  /** Role-specific area under the stage: replay controls for the coach. */
  footer?: ReactNode;
  /**
   * Replaces the live video on the stage. Used for replay review, which is the
   * only thing that takes over the stage (spec section 4.2).
   */
  stageContent?: ReactNode;
  /** LIVE, or REVIEWING LAST 15/30 SECONDS while a replay is on screen. */
  modeLabel?: string;
  /** Hidden during review so nothing overlaps the replay. */
  showSelfTile?: boolean;
};

/**
 * Shared live layout: the other participant fills the stage, own camera sits
 * in a small top-aligned tile, controls sit at the bottom. Both roles use it;
 * what differs is the copy, the footer, and whether the stage is taken over.
 *
 * The call itself is untouched by any of that - microphones and the connection
 * keep running through review (FR-12).
 */
export function LiveCallLayout({
  emptyStageMessage,
  stageLabel,
  onLeave,
  footer,
  stageContent,
  modeLabel = 'LIVE',
  showSelfTile = true,
}: LiveCallLayoutProps) {
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();
  // Explicit participant: this component sits outside a participant context,
  // and the hook has no default there.
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });
  const { remoteTrack, localTrack } = useCallTracks();

  const status = describeConnection(connectionState, quality);

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
        {stageContent ?? (
          <VideoStage
            trackRef={remoteTrack}
            emptyMessage={emptyStageMessage}
            accessibilityLabel={stageLabel}
          />
        )}

        <View style={[styles.overlayTop, { top: insets.top + spacing.sm }]} pointerEvents="none">
          <View style={styles.badges}>
            <LiveBadge label={modeLabel} />
            <ConnectionPill status={status} />
          </View>
          {showSelfTile ? <SelfTile trackRef={localTrack} cameraEnabled={isCameraEnabled} /> : null}
        </View>
      </View>

      {footer}

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
