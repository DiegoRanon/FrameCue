import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CallControls } from '@/call/components/CallControls';
import { ConnectionPill } from '@/call/components/ConnectionPill';
import { LiveBadge } from '@/call/components/LiveBadge';
import { SelfTile } from '@/call/components/SelfTile';
import { VideoStage } from '@/call/components/VideoStage';
import { useCallTracks } from '@/call/useCallTracks';
import { useConnectionStatus } from '@/call/useConnectionStatus';
import { colors, spacing } from '@/theme';

type LiveCallLayoutProps = {
  /** What fills the stage when the other participant has not joined yet. */
  emptyStageMessage: string;
  stageLabel: string;
  onLeave: () => void;
  /**
   * Coach only. Replaces Leave with End, which ends the session for both
   * participants after a confirmation (FR-17). Resolves once it has ended.
   */
  onEndSession?: () => Promise<void>;
  /** Role-specific area under the stage: replay controls for the coach. */
  footer?: ReactNode;
  /**
   * Covers the live video on the stage. Used for replay review, which is the
   * only thing that takes over the stage (spec section 4.2). The live stage
   * stays mounted underneath - see the note in the component.
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
  onEndSession,
  footer,
  stageContent,
  modeLabel = 'LIVE',
  showSelfTile = true,
}: LiveCallLayoutProps) {
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();
  const { remoteTrack, localTrack } = useCallTracks();
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  const status = useConnectionStatus();
  const reviewing = Boolean(stageContent);

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

  const confirmEnd = useCallback(() => {
    if (!onEndSession) {
      return;
    }
    // Ending is irreversible for both people, so it is never one tap.
    Alert.alert(
      'End the session?',
      'This ends the lesson for you and your student. Nothing from it is saved.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End session',
          style: 'destructive',
          onPress: () => {
            setEnding(true);
            setEndError(null);
            // On success the call screen is replaced, so only failure lands here.
            onEndSession().catch(() => {
              setEnding(false);
              setEndError('The session could not be ended. Check the connection and try again.');
            });
          },
        },
      ],
    );
  }, [onEndSession]);

  return (
    <View style={styles.root}>
      <View style={styles.stageArea}>
        {/*
          The live stage is never unmounted, only covered. `adaptiveStream`
          decides what to subscribe to from what is actually being rendered, so
          tearing this out during review would pause the incoming track - which
          would stall the coach's rolling buffer exactly when section 3.1.8
          says it must keep running, and make Return to Live wait for a
          re-subscribe instead of being instant (NFR-03).
        */}
        <View
          style={styles.stageFill}
          accessibilityElementsHidden={reviewing}
          importantForAccessibility={reviewing ? 'no-hide-descendants' : 'auto'}
        >
          <VideoStage
            trackRef={remoteTrack}
            emptyMessage={emptyStageMessage}
            accessibilityLabel={stageLabel}
          />
        </View>

        {stageContent ? <View style={styles.stageFill}>{stageContent}</View> : null}

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
        {endError ? (
          <Text accessibilityLiveRegion="polite" style={styles.endError}>
            {endError}
          </Text>
        ) : null}
        <CallControls
          micEnabled={isMicrophoneEnabled}
          cameraEnabled={isCameraEnabled}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onLeave={onEndSession ? confirmEnd : leave}
          leaveLabel={onEndSession ? (ending ? 'Ending…' : 'End') : 'Leave'}
          leaveHint={
            onEndSession ? 'End the session for you and your student' : 'Leave the session'
          }
          leaveDisabled={ending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: { alignItems: 'flex-start', gap: spacing.xs + 2 },
  controls: { backgroundColor: colors.background },
  endError: {
    color: colors.warning,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    textAlign: 'center',
  },
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
  stageFill: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
});
