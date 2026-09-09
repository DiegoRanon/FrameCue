import { useVideoPlayer } from 'expo-video';
import { useEffect } from 'react';

import { LiveCallLayout } from '@/call/LiveCallLayout';
import { useCallTracks } from '@/call/useCallTracks';
import { ReplayControls } from '@/replay/ReplayControls';
import { ReplayReviewControls } from '@/replay/ReplayReviewControls';
import { ReplayReviewStage } from '@/replay/ReplayReviewStage';
import { applyReplayCommand, configureReplayPlayer } from '@/replay/playerCommands';
import { usePendingReplay } from '@/replay/usePendingReplay';

/**
 * The coach's session: large student video, small coach tile, call controls,
 * and the replay controls underneath (spec section 4).
 *
 * Preparing a replay changes nothing here except the coach's own footer, and
 * nothing at all on the student's screen (FR-10). Show Replay takes over this
 * screen only; putting the replay on the student's screen is M4.
 */
export function CoachLiveView({ onLeave }: { onLeave: () => void }) {
  const { remoteTrack } = useCallTracks();
  const replay = usePendingReplay(remoteTrack);

  // One player for the whole session, loaded on demand. Recreating it per clip
  // left us holding a released instance whose commands silently did nothing.
  const player = useVideoPlayer(null, configureReplayPlayer);

  const reviewing = replay.phase === 'reviewing';
  const clipUri = replay.clip?.uri ?? null;

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
          // Section 3.1.5: the replay begins at its first frame.
          applyReplayCommand(player, { type: 'restart' });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [clipUri, player, reviewing]);

  return (
    <LiveCallLayout
      stageLabel="Student video"
      emptyStageMessage="Waiting for the student to join."
      onLeave={onLeave}
      modeLabel={replay.modeLabel}
      showSelfTile={!reviewing}
      stageContent={reviewing ? <ReplayReviewStage player={player} /> : undefined}
      footer={
        reviewing && replay.clip ? (
          <ReplayReviewControls
            player={player}
            clip={replay.clip}
            onReturnToLive={replay.returnToLive}
          />
        ) : (
          <ReplayControls replay={replay} />
        )
      }
    />
  );
}
