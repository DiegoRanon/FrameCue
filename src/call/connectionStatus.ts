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

/**
 * Which simulcast layer the coach should ask for from the student's camera
 * (D-012).
 *
 * The replay is cut from whatever the coach actually receives, so a call that
 * drifts down to 360p produces a 360p replay - of the movement the whole
 * product exists to judge. Pinning the highest layer keeps the buffer at one
 * resolution, which also stops `canPrepare` flapping every time the layer
 * changes and the encoded stream restarts.
 *
 * The pin is released the moment the connection is anything but healthy, so the
 * live call still degrades rather than freezing (NFR-06). Live video the lesson
 * depends on outranks replay sharpness.
 */
export type SubscriptionQuality = 'high' | 'low';

export function replaySubscriptionQuality(tone: ConnectionTone): SubscriptionQuality {
  return tone === 'good' ? 'high' : 'low';
}
