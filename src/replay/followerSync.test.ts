import type { PlaybackState } from '@/control/replayControl';
import {
  DRIFT_TOLERANCE_SECONDS,
  followUpCommands,
  forcesSeek,
  projectTarget,
  type FollowerTarget,
} from '@/replay/followerSync';

const DURATION = 15;

function state(overrides: Partial<PlaybackState> = {}): PlaybackState {
  return { positionSeconds: 4, playing: true, rate: 1, ...overrides };
}

function local(overrides: Partial<FollowerTarget> = {}): FollowerTarget {
  return { positionSeconds: 4, playing: true, rate: 1, ...overrides };
}

describe('projectTarget', () => {
  it('advances a playing coach by the elapsed time', () => {
    expect(projectTarget(state(), 1000, DURATION).positionSeconds).toBeCloseTo(5);
  });

  it('advances at half the rate at 0.5x', () => {
    expect(projectTarget(state({ rate: 0.5 }), 1000, DURATION).positionSeconds).toBeCloseTo(4.5);
  });

  it('leaves a paused coach where they stopped', () => {
    expect(projectTarget(state({ playing: false }), 5000, DURATION).positionSeconds).toBeCloseTo(4);
  });

  it('never projects past the end of the clip', () => {
    expect(projectTarget(state(), 60_000, DURATION).positionSeconds).toBe(DURATION);
  });

  it('survives an unknown duration and a nonsense elapsed time', () => {
    expect(projectTarget(state(), 1000, 0).positionSeconds).toBeCloseTo(5);
    expect(projectTarget(state(), Number.NaN, DURATION).positionSeconds).toBeCloseTo(4);
    expect(projectTarget(state(), -1000, DURATION).positionSeconds).toBeCloseTo(4);
  });
});

describe('followUpCommands', () => {
  it('does nothing when the follower already matches', () => {
    expect(followUpCommands(local(), local())).toEqual([]);
  });

  it('ignores drift inside the tolerance', () => {
    const target = local({ positionSeconds: 4 + DRIFT_TOLERANCE_SECONDS / 2 });
    expect(followUpCommands(target, local())).toEqual([]);
  });

  it('seeks once drift passes the tolerance', () => {
    const target = local({ positionSeconds: 4 + DRIFT_TOLERANCE_SECONDS + 0.1 });
    expect(followUpCommands(target, local())).toEqual([
      { type: 'seek', seconds: target.positionSeconds },
    ]);
  });

  it('corrects drift in either direction', () => {
    const target = local({ positionSeconds: 1 });
    expect(followUpCommands(target, local())).toEqual([{ type: 'seek', seconds: 1 }]);
  });

  it('seeks on a deliberate jump even when the position already matches', () => {
    expect(followUpCommands(local(), local(), { forceSeek: true })).toEqual([
      { type: 'seek', seconds: 4 },
    ]);
  });

  it('follows the coach into pause and back out', () => {
    expect(followUpCommands(local({ playing: false }), local())).toEqual([{ type: 'pause' }]);
    expect(followUpCommands(local(), local({ playing: false }))).toEqual([{ type: 'play' }]);
  });

  it('follows a rate change', () => {
    expect(followUpCommands(local({ rate: 0.5 }), local())).toEqual([{ type: 'rate', rate: 0.5 }]);
  });

  it('orders rate before seek before play, so playback resumes corrected', () => {
    const target = local({ positionSeconds: 9, playing: true, rate: 0.5 });
    expect(followUpCommands(target, local({ playing: false }))).toEqual([
      { type: 'rate', rate: 0.5 },
      { type: 'seek', seconds: 9 },
      { type: 'play' },
    ]);
  });
});

describe('forcesSeek', () => {
  it('is true only for the jumps the coach made deliberately', () => {
    expect(forcesSeek('show')).toBe(true);
    expect(forcesSeek('seek')).toBe(true);
    expect(forcesSeek('restart')).toBe(true);

    expect(forcesSeek('play')).toBe(false);
    expect(forcesSeek('pause')).toBe(false);
    expect(forcesSeek('rate')).toBe(false);
    expect(forcesSeek('sync')).toBe(false);
  });
});
