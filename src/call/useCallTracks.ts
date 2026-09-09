import { useTracks, type TrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';

export type CallTracks = {
  /** The other participant: the student for a coach, the coach for a student. */
  remoteTrack: TrackReference | undefined;
  localTrack: TrackReference | undefined;
};

/**
 * The two camera tracks in a one-to-one session.
 *
 * Shared so the layout and the role views agree on which track is on the
 * stage - the coach's replay buffer must observe exactly the track the coach
 * is watching.
 */
export function useCallTracks(): CallTracks {
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  return {
    remoteTrack: cameraTracks.find((track) => !track.participant.isLocal),
    localTrack: cameraTracks.find((track) => track.participant.isLocal),
  };
}
