import { useVideoPlayer } from 'expo-video';
import { useEffect } from 'react';

import { LiveCallLayout } from '@/call/LiveCallLayout';
import { useCallTracks } from '@/call/useCallTracks';
import { useConnectionStatus } from '@/call/useConnectionStatus';
import { useSubscriptionQuality } from '@/call/useSubscriptionQuality';
import { ReplayControls } from '@/replay/ReplayControls';
import { ReplayReviewControls } from '@/replay/ReplayReviewControls';
import { ReplayReviewStage } from '@/replay/ReplayReviewStage';
import { durationOf } from '@/replay/pendingReplay';
import { applyReplayCommand, configureReplayPlayer } from '@/replay/playerCommands';
import { useClipDelivery } from '@/replay/useClipDelivery';
import { usePendingReplay } from '@/replay/usePendingReplay';
import { useReplayDirector } from '@/replay/useReplayDirector';

/**
 * The coach's session: large student video, small coach tile, call controls,
 * and the replay controls underneath (spec section 4).
 *
 * Preparing a replay changes nothing on the student's screen (FR-10) - only the
 * clip transfer runs, in the background. Show Replay is what puts the replay on
 * both screens, and from then on every playback command the coach issues is
 * applied here and published to the student (AC-08, AC-09).
 *
 * Nothing here can end the call. Every replay failure surfaces as text on the
 * coach's own controls and the live layout underneath is untouched (NFR-04,
 * AC-14).
 */
export function CoachLiveView({
  onLeave,
  onEndSession,
}: {
  onLeave: () => void;
  onEndSession?: () => Promise<void>;
}) {
  const { remoteTrack } = useCallTracks();
  const status = useConnectionStatus();

  // Keeps the buffer on the student's highest layer while the link is healthy,
  // so a replay is worth looking at (D-012). Released automatically when it is
  // not, so the live call still adapts rather than freezing (NFR-06).
  useSubscriptionQuality(remoteTrack, status.tone);

  const replay = usePendingReplay(remoteTrack);
  const delivery = useClipDelivery(replay.clip, replay.clipId);

  // One player for the whole session, loaded on demand. Recreating it per clip
  // left us holding a released instance whose commands silently did nothing.
  const player = useVideoPlayer(null, configureReplayPlayer);

  const reviewing = replay.phase === 'reviewing';
  const clipUri = replay.clip?.uri ?? null;

  const sendCommand = useReplayDirector({
    player,
    clipId: replay.clipId,
    requestedSeconds: replay.clip ? durationOf(replay.clip) : null,
    reviewing,
  });

  useEffect(() => {
    if (!reviewing || !clipUri) {
      applyReplayCommand(player, { type: 'pause' });
      return;
    }

    let cancelled = false;
    // Load first, then play: commands issued before the source is ready are
    // dropped by the player.
    player
      .replaceAsync(clipUri)
      .then(() => {
        if (!cancelled) {
          // Section 3.1.5: the replay begins at its first frame. Sent through
          // the director so the student starts from the same frame.
          sendCommand({ type: 'restart' });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [clipUri, player, reviewing, sendCommand]);

  return (
    <LiveCallLayout
      stageLabel="Student video"
      emptyStageMessage="Waiting for the student to join."
      onLeave={onLeave}
      onEndSession={onEndSession}
      modeLabel={replay.modeLabel}
      showSelfTile={!reviewing}
      stageContent={reviewing ? <ReplayReviewStage player={player} /> : undefined}
      footer={
        reviewing && replay.clip ? (
          <ReplayReviewControls
            player={player}
            clip={replay.clip}
            onCommand={sendCommand}
            onReturnToLive={replay.returnToLive}
          />
        ) : (
          <ReplayControls replay={replay} delivery={delivery} />
        )
      }
    />
  );
}
