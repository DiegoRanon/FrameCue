import type { TrackHandle } from '@modules/replay-buffer';

/**
 * Extracts the react-native-webrtc identifiers the native buffer needs from a
 * LiveKit track reference.
 *
 * LiveKit sits on top of react-native-webrtc, so every LiveKit track carries
 * the underlying MediaStreamTrack. Those two fields - the track id and the
 * peer connection that received it - are how the native side finds the same
 * track in WebRTCModule's registry.
 */
type WebrtcMediaStreamTrack = {
  id?: string;
  /** react-native-webrtc private field: -1 for local tracks. */
  _peerConnectionId?: number;
};

type TrackReferenceLike = {
  publication?: { track?: { mediaStreamTrack?: unknown } | null } | null;
};

export function trackHandleFor(trackRef: TrackReferenceLike | undefined): TrackHandle | null {
  const mediaStreamTrack = trackRef?.publication?.track?.mediaStreamTrack as
    WebrtcMediaStreamTrack | undefined;

  if (!mediaStreamTrack?.id) {
    return null;
  }

  return {
    peerConnectionId: mediaStreamTrack._peerConnectionId ?? -1,
    trackId: mediaStreamTrack.id,
  };
}

export function sameHandle(a: TrackHandle | null, b: TrackHandle | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.trackId === b.trackId && a.peerConnectionId === b.peerConnectionId;
}
