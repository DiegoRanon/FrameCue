import type { VideoPlayer } from 'expo-video';

/**
 * Every way playback can be driven, in one place.
 *
 * These are commands, not state: the coach issues them, and in M4 the same set
 * travels over the data channel so the student's player follows (FR-11,
 * NFR-02). Keeping them here means the wire protocol and the local controls
 * cannot drift apart.
 *
 * expo-video exposes playback position and rate as mutable properties, so the
 * assignment has to happen somewhere; doing it here keeps components free of
 * it.
 */
export type ReplayCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; seconds: number }
  | { type: 'restart' }
  | { type: 'rate'; rate: ReplayRate };

/** 0.5x is the coaching speed; the MVP offers nothing finer (FR-11). */
export type ReplayRate = 0.5 | 1;

/** Treated as the end of the clip; playback rarely lands exactly on duration. */
const END_EPSILON_SECONDS = 0.15;

/** Exported because the coach announces a restart-on-play to the student. */
export function hasReachedEnd(player: VideoPlayer): boolean {
  return player.duration > 0 && player.currentTime >= player.duration - END_EPSILON_SECONDS;
}

export function applyReplayCommand(player: VideoPlayer, command: ReplayCommand): void {
  switch (command.type) {
    case 'play':
      // Play on a finished clip starts it again rather than doing nothing,
      // which is what a coach pressing Play expects.
      if (hasReachedEnd(player)) {
        player.replay();
      } else {
        player.play();
      }
      return;
    case 'pause':
      player.pause();
      return;
    case 'seek':
      player.currentTime = Math.max(command.seconds, 0);
      return;
    case 'restart':
      // Section 3.1.6: replay from the start. `replay()` rather than seeking to
      // zero, because a player that has reached the end ignores the seek.
      player.replay();
      return;
    case 'rate':
      player.playbackRate = command.rate;
      return;
  }
}

/** Configuration applied when a replay player is created. */
export function configureReplayPlayer(player: VideoPlayer): void {
  // Section 4.2: replay audio is muted so the live microphones remain the
  // communication channel. Buffered clips carry no audio track anyway.
  player.muted = true;
  player.loop = false;
  player.timeUpdateEventInterval = 0.2;
}
