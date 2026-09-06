import { LiveCallLayout } from '@/call/LiveCallLayout';

/**
 * Spec section 4: the student sees the coach and stays live at all times.
 * A pending replay on the coach's side must never change this screen (FR-10);
 * only Show Replay does, in M4.
 */
export function StudentLiveView({ onLeave }: { onLeave: () => void }) {
  return (
    <LiveCallLayout
      stageLabel="Coach video"
      emptyStageMessage="Waiting for the coach to join."
      onLeave={onLeave}
    />
  );
}
