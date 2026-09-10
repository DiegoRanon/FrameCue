import { useRoomContext } from '@livekit/components-react';
import type { VideoPlayer } from 'expo-video';
import { RoomEvent } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ClipMessage, ReplayControlMessage } from '@/control/replayControl';
import { useReplayControlListener } from '@/control/useReplayControl';
import {
  clearReceivedClips,
  deleteClipFile,
  receiveClips,
  type ReceivedClip,
} from '@/replay/clipTransfer';
import { followUpCommands, forcesSeek, projectTarget } from '@/replay/followerSync';
import type { ReplayDuration } from '@/replay/pendingReplay';
import { applyReplayCommand } from '@/replay/playerCommands';

/** Re-render threshold for transfer progress; below this it is not visible. */
const PROGRESS_STEP = 0.02;

export type ReplayFollower = {
  reviewing: boolean;
  /** LIVE, or REVIEWING LAST 15/30 SECONDS (section 4.2). */
  modeLabel: string;
  requestedSeconds: ReplayDuration | null;
  /** The coach pressed Show but the clip has not finished arriving. */
  waitingForClip: boolean;
  /** 0-1 while the clip is being received. */
  transferProgress: number;
  error: string | null;
};

type Review = { clipId: string; requestedSeconds: ReplayDuration };
type Directive = { message: ClipMessage; receivedAtMs: number; sequence: number };

/**
 * The student's side of synchronized review (spec section 3.1.7, AC-08 to
 * AC-10).
 *
 * It receives clips in the background, and renders whatever the coach says the
 * playback state is. It never originates a command: the student has no
 * controls, and nothing on this device is published on the control topic.
 *
 * The live call is untouched throughout - this drives a local file player, so
 * both microphones keep running and neither track is renegotiated (FR-12,
 * NFR-03).
 */
export function useReplayFollower(player: VideoPlayer): ReplayFollower {
  const room = useRoomContext();

  // Clips live in a ref because they are consumed by effects, not rendered;
  // the version counter is what wakes those effects.
  const clipsRef = useRef(new Map<string, ReceivedClip>());
  const [clipsVersion, setClipsVersion] = useState(0);

  const [transfer, setTransfer] = useState<{ clipId: string; progress: number } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [directive, setDirective] = useState<Directive | null>(null);
  const [loadedClipId, setLoadedClipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Anything left in the cache belongs to a session that is already over -
    // a crash or a force-close, which must not leave a replay recoverable
    // (FR-16, AC-12). Done before the handler is registered so it can never
    // remove a clip that is currently arriving.
    clearReceivedClips();

    const unregister = receiveClips(room, {
      onStarted: (clipId) => {
        setError(null);
        setTransfer({ clipId, progress: 0 });
      },
      onProgress: (clipId, fraction) => {
        setTransfer((current) =>
          current && current.clipId === clipId && fraction - current.progress < PROGRESS_STEP
            ? current
            : { clipId, progress: fraction },
        );
      },
      onReceived: (clip) => {
        clipsRef.current.set(clip.clipId, clip);
        setClipsVersion((version) => version + 1);
        setTransfer(null);
      },
      onFailed: (_clipId, message) => {
        setTransfer(null);
        setError(message);
      },
    });

    const clips = clipsRef.current;
    return () => {
      unregister();
      clips.clear();
      clearReceivedClips();
    };
  }, [room]);

  /**
   * Torn down here rather than in an effect because leaving review is an event,
   * not a state to synchronize - and it has to complete inside a second
   * (NFR-03). Unloading and deleting is what makes the replay unrecoverable the
   * moment review ends (FR-16).
   */
  const endReview = useCallback(() => {
    setReview(null);
    setDirective(null);
    setLoadedClipId(null);
    setError(null);
    applyReplayCommand(player, { type: 'pause' });
    void player.replaceAsync(null).catch(() => undefined);
    for (const clip of clipsRef.current.values()) {
      deleteClipFile(clip.uri);
    }
    clipsRef.current.clear();
  }, [player]);

  // A coach who leaves mid-replay never sends Return to Live, and the student
  // must not be left staring at a frozen clip with the call gone. The room is
  // one-to-one, so any disconnect is the coach's.
  useEffect(() => {
    room.on(RoomEvent.ParticipantDisconnected, endReview);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, endReview);
    };
  }, [endReview, room]);

  const onMessage = useCallback(
    (message: ReplayControlMessage) => {
      if (message.type === 'returnLive') {
        endReview();
        return;
      }

      setReview((current) =>
        current?.clipId === message.clipId
          ? current
          : { clipId: message.clipId, requestedSeconds: message.requestedSeconds },
      );
      setDirective((current) => {
        // The coach's clock is only compared with itself, to drop a message
        // that arrived after a newer one for the same clip.
        const stale =
          current !== null &&
          current.message.clipId === message.clipId &&
          current.message.sentAtMs > message.sentAtMs;
        return stale
          ? current
          : { message, receivedAtMs: Date.now(), sequence: (current?.sequence ?? 0) + 1 };
      });
    },
    [endReview],
  );

  useReplayControlListener(onMessage);

  // Load the clip as soon as both the file and the instruction to show it are
  // present, in whichever order they arrive.
  const reviewClipId = review?.clipId ?? null;
  useEffect(() => {
    if (!reviewClipId || loadedClipId === reviewClipId) {
      return;
    }
    const clip = clipsRef.current.get(reviewClipId);
    if (!clip) {
      return;
    }

    let cancelled = false;
    player
      .replaceAsync(clip.uri)
      .then(() => {
        if (!cancelled) {
          setLoadedClipId(reviewClipId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('The replay could not be opened.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clipsVersion, loadedClipId, player, reviewClipId]);

  const reviewing = review !== null;

  // Follow the coach. Runs per message, and again once the clip finishes
  // loading, so an instruction that arrived first is not lost.
  useEffect(() => {
    if (!directive || !loadedClipId || directive.message.clipId !== loadedClipId) {
      return;
    }

    const { message, receivedAtMs } = directive;
    const target = projectTarget(message.state, Date.now() - receivedAtMs, player.duration);
    const commands = followUpCommands(
      target,
      {
        positionSeconds: player.currentTime,
        playing: player.playing,
        rate: player.playbackRate === 0.5 ? 0.5 : 1,
      },
      { forceSeek: forcesSeek(message.type) },
    );

    for (const command of commands) {
      applyReplayCommand(player, command);
    }
  }, [directive, loadedClipId, player]);

  const waitingForClip = reviewing && loadedClipId !== reviewClipId;

  return {
    reviewing,
    modeLabel: review ? `REVIEWING LAST ${review.requestedSeconds} SECONDS` : 'LIVE',
    requestedSeconds: review?.requestedSeconds ?? null,
    waitingForClip,
    transferProgress: transfer?.clipId === reviewClipId ? transfer.progress : 0,
    error,
  };
}
