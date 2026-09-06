import { LiveCallLayout } from '@/call/LiveCallLayout';

/**
 * Spec section 4: large student video, small coach tile, call controls.
 * Prepare 15s / Prepare 30s and the Replay Ready card arrive in M3 and will
 * be passed as the layout footer.
 */
export function CoachLiveView({ onLeave }: { onLeave: () => void }) {
  return (
    <LiveCallLayout
      stageLabel="Student video"
      emptyStageMessage="Waiting for the student to join."
      onLeave={onLeave}
    />
  );
}
