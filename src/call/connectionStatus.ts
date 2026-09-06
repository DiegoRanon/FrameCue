/**
 * Turns LiveKit's connection state and quality into something a coach or
 * student can act on. FR-18 and spec section 4.1: no technical jargon.
 *
 * Takes plain strings rather than the livekit-client enums (which are string
 * enums with exactly these values) so the mapping stays pure and testable.
 */
export type ConnectionTone = 'good' | 'warning' | 'bad';

export type ConnectionStatus = {
  label: string;
  tone: ConnectionTone;
  /** True once media can flow, which is what the UI gates the stage on. */
  isLive: boolean;
};

export function describeConnection(state: string, quality: string): ConnectionStatus {
  switch (state) {
    case 'connecting':
      return { label: 'Connecting', tone: 'warning', isLive: false };
    case 'reconnecting':
    case 'signalReconnecting':
      return { label: 'Reconnecting', tone: 'warning', isLive: false };
    case 'disconnected':
      return { label: 'Not connected', tone: 'bad', isLive: false };
    case 'connected':
      break;
    default:
      return { label: 'Not connected', tone: 'bad', isLive: false };
  }

  switch (quality) {
    case 'lost':
      return { label: 'Connection lost', tone: 'bad', isLive: true };
    case 'poor':
      return { label: 'Weak connection', tone: 'warning', isLive: true };
    default:
      return { label: 'Connected', tone: 'good', isLive: true };
  }
}
