import { useVideoPlayer } from 'expo-video';

import { LiveCallLayout } from '@/call/LiveCallLayout';
import { ReplayReviewStage } from '@/replay/ReplayReviewStage';
import { StudentReviewStatus } from '@/replay/StudentReviewStatus';
import { configureReplayPlayer } from '@/replay/playerCommands';
import { useReplayFollower } from '@/replay/useReplayFollower';

/**
 * Spec section 4: the student sees the coach and stays live at all times,
 * until the coach shows a replay.
 *
 * A pending replay on the coach's side never changes this screen (FR-10). Show
 * Replay does, and from then on playback here mirrors the coach's, with no
 * controls of the student's own (section 3.1.7).
 */
export function StudentLiveView({ onLeave }: { onLeave: () => void }) {
  const player = useVideoPlayer(null, configureReplayPlayer);
  const follower = useReplayFollower(player);

  return (
    <LiveCallLayout
      stageLabel="Coach video"
      emptyStageMessage="Waiting for the coach to join."
      onLeave={onLeave}
      modeLabel={follower.modeLabel}
      showSelfTile={!follower.reviewing}
      stageContent={
        follower.reviewing ? (
          <ReplayReviewStage
            player={player}
            overlayMessage={follower.waitingForClip ? waitingMessage(follower) : null}
          />
        ) : undefined
      }
      footer={
        follower.reviewing ? (
          <StudentReviewStatus player={player} requestedSeconds={follower.requestedSeconds} />
        ) : undefined
      }
    />
  );
}

/**
 * The gap between Show Replay and the clip being playable here, which normally
 * does not exist because the transfer finished while the replay was pending
 * (D-001). No progress bar and no jargon - the student is mid-lesson.
 */
function waitingMessage(follower: { error: string | null; transferProgress: number }): string {
  if (follower.error) {
    return 'The replay could not be opened. Your coach can send it again.';
  }
  return follower.transferProgress > 0
    ? `Your coach is opening a replay… ${Math.round(follower.transferProgress * 100)}%`
    : 'Your coach is opening a replay…';
}
