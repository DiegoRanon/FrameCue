import {
  discardClip,
  getStatus,
  IDLE_STATUS,
  isReplayBufferAvailable,
  prepareClip,
  startBuffering,
  stopBuffering,
  type PreparedClip,
  type ReplayBufferStatus,
} from '@modules/replay-buffer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { trackHandleFor } from '@/replay/trackHandle';

/** Enough history for the shorter and longer replay (AC-04, AC-05). */
export const PREPARE_15_SECONDS = 15;
export const PREPARE_30_SECONDS = 30;

export type ReplayBufferState = {
  status: ReplayBufferStatus;
  clip: PreparedClip | null;
  error: string | null;
  canPrepare15: boolean;
  canPrepare30: boolean;
  prepare: (seconds: 15 | 30) => Promise<void>;
  discard: () => Promise<void>;
};

type TrackReferenceLike = Parameters<typeof trackHandleFor>[0];

/**
 * Buffers the incoming track for as long as it is subscribed, and prepares
 * clips from it on request.
 *
 * Preparing does not touch the call or either participant's view (FR-10); it
 * only reads what the buffer already holds. Only one prepared clip exists at a
 * time - preparing again deletes the previous file (spec section 5.1).
 */
export function useReplayBuffer(trackRef: TrackReferenceLike): ReplayBufferState {
  const handle = useMemo(() => trackHandleFor(trackRef), [trackRef]);
  // Primitives, so the buffering effect re-runs when the track actually
  // changes rather than on every re-render that rebuilds the object.
  const peerConnectionId = handle?.peerConnectionId ?? null;
  const trackId = handle?.trackId ?? null;

  const [status, setStatus] = useState<ReplayBufferStatus>(IDLE_STATUS);
  const [clip, setClip] = useState<PreparedClip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clipRef = useRef<PreparedClip | null>(null);

  useEffect(() => {
    clipRef.current = clip;
  }, [clip]);

  useEffect(() => {
    if (peerConnectionId === null || trackId === null || !isReplayBufferAvailable) {
      return;
    }

    let cancelled = false;
    startBuffering({ peerConnectionId, trackId }).catch((caught: Error) => {
      if (!cancelled) {
        setError(caught.message);
      }
    });

    return () => {
      cancelled = true;
      // Leaving the call, or the track being replaced, ends the buffer and
      // frees the encoder (FR-16).
      void stopBuffering().catch(() => undefined);
    };
  }, [peerConnectionId, trackId]);

  useEffect(() => {
    if (!isReplayBufferAvailable) {
      return;
    }
    const timer = setInterval(() => setStatus(getStatus()), 500);
    return () => clearInterval(timer);
  }, []);

  const prepare = useCallback(async (seconds: 15 | 30) => {
    try {
      setError(null);
      const previous = clipRef.current;
      const prepared = await prepareClip(seconds);
      setClip(prepared);
      if (previous) {
        await discardClip(previous.path).catch(() => undefined);
      }
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, []);

  const discard = useCallback(async () => {
    const current = clipRef.current;
    setClip(null);
    if (current) {
      await discardClip(current.path).catch(() => undefined);
    }
  }, []);

  return {
    status,
    clip,
    error,
    canPrepare15: status.buffering && status.availableSeconds >= PREPARE_15_SECONDS,
    canPrepare30: status.buffering && status.availableSeconds >= PREPARE_30_SECONDS,
    prepare,
    discard,
  };
}
