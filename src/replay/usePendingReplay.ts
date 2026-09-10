import {
  clearAll,
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
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import {
  canPrepare,
  clipIdFor,
  initialPendingReplay,
  modeLabelFor,
  pendingReplayReducer,
  secondsUntilAvailable,
  type PendingReplayPhase,
  type ReplayDuration,
} from '@/replay/pendingReplay';
import { useAppActive } from '@/call/useAppActive';
import { trackHandleFor } from '@/replay/trackHandle';

export type PendingReplayControls = {
  phase: PendingReplayPhase;
  clip: PreparedClip | null;
  /** Opaque id the clip is addressed by on the wire; null when none is pending. */
  clipId: string | null;
  status: ReplayBufferStatus;
  error: string | null;
  /** Duration awaiting confirmation, null when the coach still has to choose. */
  pendingSeconds: ReplayDuration | null;
  modeLabel: string;
  canPrepare15: boolean;
  canPrepare30: boolean;
  countdown15: number | null;
  countdown30: number | null;
  prepare: (seconds: ReplayDuration) => void;
  replace: () => void;
  confirmReplace: (seconds?: ReplayDuration) => void;
  cancelReplace: () => void;
  discard: () => void;
  show: () => void;
  returnToLive: () => void;
};

type TrackReferenceLike = Parameters<typeof trackHandleFor>[0];

/**
 * Owns the pending replay for the coach: keeps the incoming track buffered,
 * runs prepare requests, and deletes clip files the moment they stop being the
 * pending replay (FR-16).
 *
 * The rules live in `pendingReplay.ts`; this hook only performs their effects.
 */
export function usePendingReplay(trackRef: TrackReferenceLike): PendingReplayControls {
  const handle = useMemo(() => trackHandleFor(trackRef), [trackRef]);
  // Primitives, so buffering restarts when the track really changes rather
  // than on every render that rebuilds the object.
  const peerConnectionId = handle?.peerConnectionId ?? null;
  const trackId = handle?.trackId ?? null;

  const [status, setStatus] = useState<ReplayBufferStatus>(IDLE_STATUS);
  const [state, dispatch] = useReducer(pendingReplayReducer, initialPendingReplay);

  // Backgrounding stops the buffer and empties it (FR-16). A pending replay is
  // deliberately kept: it is already a written file, and losing it because the
  // coach glanced at a notification would throw away the moment they were
  // waiting to show. On return, buffering restarts from empty, so the
  // countdown to Prepare runs again - which is honest, because the window
  // really was interrupted (section 3.2).
  const appActive = useAppActive();

  useEffect(() => {
    if (peerConnectionId === null || trackId === null || !isReplayBufferAvailable || !appActive) {
      return;
    }

    let cancelled = false;
    startBuffering({ peerConnectionId, trackId }).catch((caught: Error) => {
      if (!cancelled) {
        dispatch({ type: 'prepareFailed', message: caught.message });
      }
    });

    return () => {
      cancelled = true;
      void stopBuffering().catch(() => undefined);
    };
  }, [appActive, peerConnectionId, trackId]);

  useEffect(() => {
    if (!isReplayBufferAvailable) {
      return;
    }
    const timer = setInterval(() => setStatus(getStatus()), 500);
    return () => clearInterval(timer);
  }, []);

  // One prepare per attempt. The attempt counter is what makes a replace of the
  // same duration run again rather than being swallowed as a no-op.
  const { phase, requestedSeconds, attempt } = state;
  useEffect(() => {
    if (phase !== 'preparing' || requestedSeconds === null) {
      return;
    }

    let cancelled = false;
    prepareClip(requestedSeconds)
      .then((clip) => {
        if (!cancelled) {
          dispatch({ type: 'prepareSucceeded', clip });
        }
      })
      .catch((caught: Error) => {
        if (!cancelled) {
          dispatch({ type: 'prepareFailed', message: caught.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [phase, requestedSeconds, attempt]);

  /**
   * A clip file exists only while it is the pending replay. Whenever the
   * pending replay changes - replaced, discarded, or cleared after review -
   * the file it replaced is deleted (FR-16).
   */
  const currentPath = state.clip?.path ?? null;
  const lastPathRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastPathRef.current;
    lastPathRef.current = currentPath;
    if (previous && previous !== currentPath) {
      void discardClip(previous).catch(() => undefined);
    }
  }, [currentPath]);

  /**
   * Leaving the session takes everything with it: the encoder is released, the
   * ring buffer emptied, and every clip file deleted (FR-16).
   *
   * This runs on a deliberate Leave and equally on a fatal disconnect, because
   * both unmount the live view. `clearAll` rather than discarding the one known
   * path, so a clip orphaned by a failure earlier in the session goes too.
   */
  useEffect(
    () => () => {
      void clearAll().catch(() => undefined);
    },
    [],
  );

  const prepare = useCallback(
    (seconds: ReplayDuration) => dispatch({ type: 'prepare', seconds }),
    [],
  );
  const replace = useCallback(() => dispatch({ type: 'replace' }), []);
  const confirmReplace = useCallback(
    (seconds?: ReplayDuration) => dispatch({ type: 'confirmReplace', seconds }),
    [],
  );
  const cancelReplace = useCallback(() => dispatch({ type: 'cancelReplace' }), []);
  const discard = useCallback(() => dispatch({ type: 'discard' }), []);
  const show = useCallback(() => dispatch({ type: 'show' }), []);
  const returnToLive = useCallback(() => dispatch({ type: 'returnToLive' }), []);

  return {
    phase: state.phase,
    clip: state.clip,
    clipId: state.clip ? clipIdFor(state.clip) : null,
    status,
    error: state.error,
    pendingSeconds: state.requestedSeconds,
    modeLabel: modeLabelFor(state),
    canPrepare15: canPrepare(state, 15, status.availableSeconds, status.buffering),
    canPrepare30: canPrepare(state, 30, status.availableSeconds, status.buffering),
    countdown15: secondsUntilAvailable(15, status.availableSeconds),
    countdown30: secondsUntilAvailable(30, status.availableSeconds),
    prepare,
    replace,
    confirmReplace,
    cancelReplace,
    discard,
    show,
    returnToLive,
  };
}
