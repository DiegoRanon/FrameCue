import type { ClipMessageType, PlaybackState } from '@/control/replayControl';
import type { ReplayCommand, ReplayRate } from '@/replay/playerCommands';

/**
 * Turning the coach's authoritative playback state into commands for the
 * student's player (NFR-02: positions differ by no more than ~500 ms).
 *
 * Pure on purpose - this is the part of synchronization worth testing without a
 * device, in the same spirit as the pending-replay state machine.
 *
 * Why elapsed time is measured locally: the message carries the coach's clock,
 * but the two phones' clocks are unrelated, so subtracting one from the other
 * would bake in an arbitrary offset. The follower instead measures from the
 * moment the message arrived. That silently treats one-way network latency as
 * zero, which on a reliable data channel is tens of milliseconds - an order of
 * magnitude inside the budget - and is the only term we can measure without a
 * clock-sync handshake the MVP does not need.
 */
export type FollowerTarget = {
  positionSeconds: number;
  playing: boolean;
  rate: ReplayRate;
};

/**
 * Half the NFR-02 budget, so a correction happens well before the requirement
 * is at risk. Below roughly this value, seeking corrects less than the visible
 * stutter it causes.
 */
export const DRIFT_TOLERANCE_SECONDS = 0.3;

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return max > 0 ? Math.min(value, max) : value;
}

/**
 * Where the coach's playback has reached by now, given how long ago the message
 * describing it arrived. A paused coach does not move; a playing one advances
 * at the playback rate.
 */
export function projectTarget(
  state: PlaybackState,
  elapsedMs: number,
  durationSeconds: number,
): FollowerTarget {
  const elapsedSeconds = Number.isFinite(elapsedMs) ? Math.max(elapsedMs, 0) / 1000 : 0;
  const advanced = state.playing
    ? state.positionSeconds + elapsedSeconds * state.rate
    : state.positionSeconds;

  return {
    positionSeconds: clamp(advanced, durationSeconds),
    playing: state.playing,
    rate: state.rate,
  };
}

/**
 * A jump the coach made deliberately is always followed exactly; everything
 * else is only corrected once it drifts past the tolerance, so ordinary
 * playback is not interrupted by a seek every heartbeat.
 */
export function forcesSeek(type: ClipMessageType): boolean {
  return type === 'show' || type === 'seek' || type === 'restart';
}

/**
 * The commands that bring the follower's player in line with the coach.
 *
 * Ordered so the result is correct however many are issued: rate first (it
 * changes what a position means from here on), then position, then play state
 * (so playback resumes from the corrected position rather than the old one).
 */
export function followUpCommands(
  target: FollowerTarget,
  local: FollowerTarget,
  options: { forceSeek?: boolean } = {},
): ReplayCommand[] {
  const commands: ReplayCommand[] = [];

  if (target.rate !== local.rate) {
    commands.push({ type: 'rate', rate: target.rate });
  }

  const drift = Math.abs(target.positionSeconds - local.positionSeconds);
  if (options.forceSeek || drift > DRIFT_TOLERANCE_SECONDS) {
    commands.push({ type: 'seek', seconds: target.positionSeconds });
  }

  if (target.playing !== local.playing) {
    commands.push({ type: target.playing ? 'play' : 'pause' });
  }

  return commands;
}
