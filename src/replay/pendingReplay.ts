import type { PreparedClip } from '@modules/replay-buffer';

export type ReplayDuration = 15 | 30;

/**
 * The coach's pending replay, as a state machine.
 *
 * The rules it encodes come straight from the spec: exactly one pending replay
 * at a time, replacing one requires confirmation, and the replay is cleared
 * after review, discard, replacement, or session end (sections 3.1, 5.1, and
 * the risk table in section 10).
 *
 * It is deliberately pure - no files, no native calls - so the rules can be
 * tested without a device. The hook around it performs the effects.
 */
export type PendingReplayPhase = 'idle' | 'preparing' | 'ready' | 'confirmingReplace' | 'reviewing';

export type PendingReplayState = {
  phase: PendingReplayPhase;
  clip: PreparedClip | null;
  /**
   * Duration the in-flight or awaiting-confirmation request is for. Null while
   * confirming a replace whose new duration has not been chosen yet.
   */
  requestedSeconds: ReplayDuration | null;
  /** Bumped whenever a prepare starts, so each request runs exactly once. */
  attempt: number;
  error: string | null;
};

export type PendingReplayEvent =
  | { type: 'prepare'; seconds: ReplayDuration }
  | { type: 'replace' }
  | { type: 'confirmReplace'; seconds?: ReplayDuration }
  | { type: 'cancelReplace' }
  | { type: 'prepareSucceeded'; clip: PreparedClip }
  | { type: 'prepareFailed'; message: string }
  | { type: 'discard' }
  | { type: 'show' }
  | { type: 'returnToLive' }
  | { type: 'sessionEnded' };

export const initialPendingReplay: PendingReplayState = {
  phase: 'idle',
  clip: null,
  requestedSeconds: null,
  attempt: 0,
  error: null,
};

function startPreparing(state: PendingReplayState, seconds: ReplayDuration): PendingReplayState {
  return {
    ...state,
    phase: 'preparing',
    requestedSeconds: seconds,
    attempt: state.attempt + 1,
    error: null,
  };
}

export function pendingReplayReducer(
  state: PendingReplayState,
  event: PendingReplayEvent,
): PendingReplayState {
  switch (event.type) {
    case 'prepare':
      // Preparing over an existing replay is a replacement, and section 5.1
      // requires confirmation before one is thrown away.
      if (state.phase === 'ready' || state.phase === 'reviewing') {
        return { ...state, phase: 'confirmingReplace', requestedSeconds: event.seconds };
      }
      if (state.phase === 'idle') {
        return startPreparing(state, event.seconds);
      }
      return state;

    case 'replace':
      // Same confirmation, entered from the card rather than a prepare button,
      // so the duration is chosen as part of confirming.
      return state.phase === 'ready'
        ? { ...state, phase: 'confirmingReplace', requestedSeconds: null }
        : state;

    case 'confirmReplace': {
      if (state.phase !== 'confirmingReplace') {
        return state;
      }
      const seconds = event.seconds ?? state.requestedSeconds;
      return seconds === null ? state : startPreparing(state, seconds);
    }

    case 'cancelReplace':
      return state.phase === 'confirmingReplace'
        ? { ...state, phase: 'ready', requestedSeconds: null }
        : state;

    case 'prepareSucceeded':
      return state.phase === 'preparing'
        ? { ...state, phase: 'ready', clip: event.clip, requestedSeconds: null, error: null }
        : state;

    case 'prepareFailed':
      if (state.phase !== 'preparing') {
        return state;
      }
      // A failed replacement leaves the previous replay untouched, which is
      // what the coach still has to work with.
      return {
        ...state,
        phase: state.clip ? 'ready' : 'idle',
        requestedSeconds: null,
        error: event.message,
      };

    case 'discard':
      return { ...initialPendingReplay, attempt: state.attempt };

    case 'show':
      return state.phase === 'ready' ? { ...state, phase: 'reviewing' } : state;

    case 'returnToLive':
      // Section 10: the pending replay is cleared after review. The buffer
      // keeps running, so the coach can prepare another one immediately.
      return state.phase === 'reviewing'
        ? { ...initialPendingReplay, attempt: state.attempt }
        : state;

    case 'sessionEnded':
      return { ...initialPendingReplay, attempt: state.attempt };

    default:
      return state;
  }
}

/**
 * Prepare is unavailable until that much continuous video exists (AC-04,
 * AC-05), and while a prepare is already running.
 */
export function canPrepare(
  state: PendingReplayState,
  seconds: ReplayDuration,
  availableSeconds: number,
  buffering: boolean,
): boolean {
  if (!buffering || state.phase === 'preparing') {
    return false;
  }
  return availableSeconds >= seconds;
}

/** Seconds of history still needed, or null when the request can be made. */
export function secondsUntilAvailable(
  seconds: ReplayDuration,
  availableSeconds: number,
): number | null {
  const remaining = Math.ceil(seconds - availableSeconds);
  return remaining > 0 ? remaining : null;
}

/** Section 4.2: only Show Replay changes the mode label. */
export function modeLabelFor(state: PendingReplayState): string {
  if (state.phase !== 'reviewing' || !state.clip) {
    return 'LIVE';
  }
  return `REVIEWING LAST ${state.clip.requestedSeconds} SECONDS`;
}
