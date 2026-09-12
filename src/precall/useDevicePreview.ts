import {
  createLocalAudioTrack,
  createLocalVideoTrack,
  VideoPresets,
  type LocalAudioTrack,
  type LocalVideoTrack,
} from 'livekit-client';
import { useEffect, useState } from 'react';

import type { FacingMode } from '@/call/roomOptions';

export type DevicePreview = {
  video: LocalVideoTrack | null;
  audio: LocalAudioTrack | null;
  error: string | null;
};

/**
 * Local camera and microphone for the pre-call check (FR-05). Nothing is
 * published or recorded: these tracks only feed the preview and the level
 * meter, and they are stopped when the check is left so the call can open the
 * devices for itself.
 */
export function useDevicePreview(enabled: boolean, facingMode: FacingMode): DevicePreview {
  const [video, setVideo] = useState<LocalVideoTrack | null>(null);
  const [audio, setAudio] = useState<LocalAudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    let created: LocalVideoTrack | null = null;
    createLocalVideoTrack({ facingMode, resolution: VideoPresets.h720.resolution })
      .then((track) => {
        created = track;
        if (cancelled) {
          track.stop();
          return;
        }
        setError(null);
        setVideo(track);
      })
      .catch(() => {
        if (!cancelled) {
          setError('The camera could not be started. Another app may be using it.');
        }
      });
    return () => {
      cancelled = true;
      created?.stop();
    };
  }, [enabled, facingMode]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    let created: LocalAudioTrack | null = null;
    createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true })
      .then((track) => {
        created = track;
        if (cancelled) {
          track.stop();
          return;
        }
        setAudio(track);
      })
      .catch(() => {
        if (!cancelled) {
          setError('The microphone could not be started. Another app may be using it.');
        }
      });
    return () => {
      cancelled = true;
      created?.stop();
    };
  }, [enabled]);

  return { video, audio, error };
}
