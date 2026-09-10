import { useRemoteParticipants, useRoomContext } from '@livekit/components-react';
import type { PreparedClip } from '@modules/replay-buffer';
import { useCallback, useEffect, useState } from 'react';

import { sendClip } from '@/replay/clipTransfer';
import { durationOf } from '@/replay/pendingReplay';

/**
 * `waitingForStudent` is not an error: the coach can prepare a replay before
 * the student has joined, and the transfer starts as soon as they do.
 */
export type ClipDeliveryPhase = 'idle' | 'waitingForStudent' | 'sending' | 'delivered' | 'failed';

export type ClipDelivery = {
  phase: ClipDeliveryPhase;
  /** 0-1 while sending. */
  progress: number;
  error: string | null;
  retry: () => void;
};

type Outcome = { key: string; phase: 'delivered' | 'failed'; error: string | null };

/**
 * Pushes the pending replay to the student in the background (D-001).
 *
 * This runs the moment a clip is prepared, not when the coach presses Show,
 * which is what makes Show effectively instant (NFR-01). The coach is never
 * blocked on it: a transfer still in flight is a state the student's screen
 * handles, and only an outright failure gets in the coach's way, with a retry
 * (spec section 3.2).
 *
 * Only the *outcome* is stored. Everything else about the phase is derivable
 * from what is already on screen, so a render never waits on an effect to
 * catch up, and a stale result cannot be attributed to a newer attempt - each
 * one is tagged with the transfer it belongs to.
 */
export function useClipDelivery(clip: PreparedClip | null, clipId: string | null): ClipDelivery {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  // A string, so effects compare by value rather than by array identity.
  const identities = remoteParticipants.map((participant) => participant.identity).join(' ');

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [progress, setProgress] = useState<{ key: string; value: number } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const transferable = clip !== null && clipId !== null && identities.length > 0;
  const key = transferable ? `${clipId}|${attempt}|${identities}` : null;

  useEffect(() => {
    if (!clip || !clipId || key === null) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    sendClip(
      room,
      {
        clipId,
        clip,
        requestedSeconds: durationOf(clip),
        destinationIdentities: identities.split(' '),
      },
      {
        signal: controller.signal,
        onProgress: (value) => {
          if (!cancelled) {
            setProgress({ key, value });
          }
        },
      },
    )
      .then(() => {
        if (!cancelled) {
          setOutcome({ key, phase: 'delivered', error: null });
        }
      })
      .catch((caught: Error) => {
        if (!cancelled) {
          setOutcome({ key, phase: 'failed', error: caught.message });
        }
      });

    return () => {
      // The clip was replaced, discarded, or the session ended. Aborting leaves
      // the stream short, so the student discards the partial file.
      cancelled = true;
      controller.abort();
    };
  }, [clip, clipId, identities, key, room]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const phase: ClipDeliveryPhase =
    !clip || !clipId
      ? 'idle'
      : identities.length === 0
        ? 'waitingForStudent'
        : outcome?.key === key
          ? outcome.phase
          : 'sending';

  return {
    phase,
    progress: phase === 'delivered' ? 1 : progress?.key === key ? progress.value : 0,
    error: phase === 'failed' ? (outcome?.error ?? null) : null,
    retry,
  };
}
