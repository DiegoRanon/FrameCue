import type { TrackReference } from '@livekit/components-react';

import { LiveCallLayout } from '@/call/LiveCallLayout';
import { ReplayBufferPanel } from '@/replay/ReplayBufferPanel';
import { useReplayBuffer } from '@/replay/useReplayBuffer';

/**
 * Spec section 4: large student video, small coach tile, call controls, and
 * the replay controls underneath.
 *
 * The panel below the stage is milestone 2 instrumentation; M3 replaces it
 * with the Replay Ready card and its Show Replay, Replace, and Discard
 * actions.
 */
export function CoachLiveView({ onLeave }: { onLeave: () => void }) {
  return (
    <LiveCallLayout
      stageLabel="Student video"
      emptyStageMessage="Waiting for the student to join."
      onLeave={onLeave}
      footer={(remoteTrack) => <CoachReplayControls trackRef={remoteTrack} />}
    />
  );
}

function CoachReplayControls({ trackRef }: { trackRef: TrackReference | undefined }) {
  const replay = useReplayBuffer(trackRef);
  return <ReplayBufferPanel state={replay} />;
}
