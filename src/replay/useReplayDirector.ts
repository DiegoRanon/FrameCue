import { useEventListener } from 'expo';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef } from 'react';

import {
  clipMessage,
  returnLiveMessage,
  type ClipMessageType,
  type PlaybackState,
} from '@/control/replayControl';
import { useReplayControlSender } from '@/control/useReplayControl';
import type { ReplayDuration } from '@/replay/pendingReplay';
import {
  applyReplayCommand,
  hasReachedEnd,
  type ReplayCommand,
  type ReplayRate,
} from '@/replay/playerCommands';

/**
 * How often the coach restates what their player is doing while a replay is on
 * screen. Fast enough that a follower recovers from a missed command or a
 * decoder stall well inside the 500 ms drift budget (NFR-02), slow enough to be
 * nothing next to the live media on the same connection.
 */
const SYNC_INTERVAL_MS = 1000;

/**
 * The coach's side of synchronized review: every playback command is applied to
 * the local player and published to the student in the same breath, so the two
 * screens cannot get different instructions (FR-11, AC-09).
 *
 * The coach is authoritative and nothing here waits for the student. Publishing
 * is fire-and-forget; correctness is restored by the heartbeat rather than by
 * retrying a specific message.
 */
export function useReplayDirector(params: {
  player: VideoPlayer;
  clipId: string | null;
  requestedSeconds: ReplayDuration | null;
  reviewing: boolean;
}): (command: ReplayCommand) => void {
  const { player, clipId, requestedSeconds, reviewing } = params;
  const send = useReplayControlSender();

  const broadcast = useCallback(
    (type: ClipMessageType, overrides: Partial<PlaybackState> = {}) => {
      if (!clipId || requestedSeconds === null) {
        return;
      }
      send(
        clipMessage({
          type,
          clipId,
          requestedSeconds,
          positionSeconds: overrides.positionSeconds ?? player.currentTime,
          playing: overrides.playing ?? player.playing,
          rate: overrides.rate ?? (player.playbackRate === 0.5 ? 0.5 : 1),
        }),
      );
    },
    [clipId, player, requestedSeconds, send],
  );

  /**
   * Overrides exist because a property read straight after a command can still
   * report the old value - the native player applies the change asynchronously.
   * What the command means is unambiguous, so it is stated rather than polled.
   */
  const dispatch = useCallback(
    (command: ReplayCommand) => {
      const restarting = command.type === 'play' && hasReachedEnd(player);
      applyReplayCommand(player, command);

      switch (command.type) {
        case 'play':
          broadcast('play', { playing: true, ...(restarting ? { positionSeconds: 0 } : {}) });
          return;
        case 'pause':
          broadcast('pause', { playing: false });
          return;
        case 'seek':
          broadcast('seek', { positionSeconds: Math.max(command.seconds, 0) });
          return;
        case 'restart':
          broadcast('restart', { positionSeconds: 0 });
          return;
        case 'rate':
          broadcast('rate', { rate: command.rate });
          return;
      }
    },
    [broadcast, player],
  );

  // The player is the source of truth for what actually happened. When it
  // reports a change - including one the coach did not cause, such as reaching
  // the end of the clip - the student is told immediately rather than waiting
  // for the next heartbeat.
  useEventListener(player, 'playingChange', ({ isPlaying }: { isPlaying: boolean }) => {
    if (reviewing) {
      broadcast('sync', { playing: isPlaying });
    }
  });
  useEventListener(player, 'playbackRateChange', ({ playbackRate }: { playbackRate: number }) => {
    if (reviewing) {
      broadcast('sync', { rate: (playbackRate === 0.5 ? 0.5 : 1) as ReplayRate });
    }
  });

  // Show and Return to Live are the two edges of review, and both are announced
  // exactly once (AC-08, AC-10).
  const announcedRef = useRef(false);
  useEffect(() => {
    if (reviewing && clipId && requestedSeconds !== null) {
      if (!announcedRef.current) {
        announcedRef.current = true;
        // The clip opens on its first frame, paused, on both screens
        // (section 3.1.5). The coach's own load then issues Restart.
        broadcast('show', { positionSeconds: 0, playing: false, rate: 1 });
      }
      return;
    }

    if (announcedRef.current) {
      announcedRef.current = false;
      send(returnLiveMessage());
    }
  }, [broadcast, clipId, requestedSeconds, reviewing, send]);

  useEffect(() => {
    if (!reviewing || !clipId) {
      return;
    }
    const timer = setInterval(() => broadcast('sync'), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [broadcast, clipId, reviewing]);

  return dispatch;
}
