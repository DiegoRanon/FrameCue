import type { TrackReference } from '@livekit/components-react';
import { VideoQuality, type RemoteTrackPublication } from 'livekit-client';
import { useEffect } from 'react';

import { replaySubscriptionQuality, type ConnectionTone } from '@/call/connectionStatus';

/**
 * Pins the coach's subscription to the student's highest simulcast layer while
 * the connection is healthy, and releases it when it is not (D-012).
 *
 * Coach-side only: it is the coach's received track that the replay buffer
 * encodes, so this is the one subscription whose resolution decides whether a
 * replay is worth looking at.
 *
 * Releasing on anything but a healthy connection is what keeps NFR-06 intact -
 * the client can still step down rather than freeze the live video.
 */
export function useSubscriptionQuality(
  trackRef: TrackReference | undefined,
  tone: ConnectionTone,
): void {
  const quality = replaySubscriptionQuality(tone);
  const publication = trackRef?.publication;

  useEffect(() => {
    // Local publications have no `setVideoQuality`; only a subscriber can ask
    // for a layer.
    if (!publication || !('setVideoQuality' in publication)) {
      return;
    }
    (publication as RemoteTrackPublication).setVideoQuality(
      quality === 'high' ? VideoQuality.HIGH : VideoQuality.LOW,
    );
  }, [publication, quality]);
}
