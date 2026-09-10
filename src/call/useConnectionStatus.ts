import {
  useConnectionQualityIndicator,
  useConnectionState,
  useLocalParticipant,
} from '@livekit/components-react';

import { describeConnection, type ConnectionStatus } from '@/call/connectionStatus';

/**
 * The connection state as the user sees it.
 *
 * Shared so the badge and the replay subscription pin cannot disagree: the
 * layer the coach asks for is decided by the same signal that is on screen
 * (D-012), rather than by a second, separately-derived idea of "healthy".
 */
export function useConnectionStatus(): ConnectionStatus {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  // Explicit participant: this runs outside a participant context, where the
  // hook has no default.
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });

  return describeConnection(connectionState, quality);
}
