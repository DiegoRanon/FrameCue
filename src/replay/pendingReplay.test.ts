import type { PreparedClip } from '@modules/replay-buffer';

import {
  canPrepare,
  initialPendingReplay,
  modeLabelFor,
  pendingReplayReducer,
  secondsUntilAvailable,
  type PendingReplayEvent,
  type PendingReplayState,
} from './pendingReplay';

const clip = (seconds: 15 | 30, path = '/cache/replay-1.mp4'): PreparedClip => ({
  uri: `file://${path}`,
  path,
  durationSeconds: seconds - 0.4,
  sampleCount: 300,
  sizeBytes: 2_800_000,
  requestedSeconds: seconds,
});

const run = (events: PendingReplayEvent[], from = initialPendingReplay): PendingReplayState =>
  events.reduce(pendingReplayReducer, from);

const readyWith = (seconds: 15 | 30 = 15, path?: string) =>
  run([
    { type: 'prepare', seconds },
    { type: 'prepareSucceeded', clip: clip(seconds, path) },
  ]);

describe('preparing a replay', () => {
  it('goes idle to preparing to ready', () => {
    const preparing = pendingReplayReducer(initialPendingReplay, { type: 'prepare', seconds: 15 });
    expect(preparing.phase).toBe('preparing');
    expect(preparing.requestedSeconds).toBe(15);
    expect(preparing.attempt).toBe(1);

    const ready = pendingReplayReducer(preparing, { type: 'prepareSucceeded', clip: clip(15) });
    expect(ready.phase).toBe('ready');
    expect(ready.clip?.requestedSeconds).toBe(15);
  });

  it('ignores a second prepare while one is already running', () => {
    const preparing = pendingReplayReducer(initialPendingReplay, { type: 'prepare', seconds: 15 });
    expect(pendingReplayReducer(preparing, { type: 'prepare', seconds: 30 })).toBe(preparing);
  });

  it('returns to idle and reports the reason when preparing fails', () => {
    const failed = run([
      { type: 'prepare', seconds: 30 },
      { type: 'prepareFailed', message: 'Not enough buffered video yet' },
    ]);
    expect(failed.phase).toBe('idle');
    expect(failed.error).toBe('Not enough buffered video yet');
    expect(failed.clip).toBeNull();
  });
});

describe('replacing the pending replay', () => {
  it('asks for confirmation instead of replacing outright', () => {
    const confirming = pendingReplayReducer(readyWith(15), { type: 'prepare', seconds: 30 });
    expect(confirming.phase).toBe('confirmingReplace');
    expect(confirming.requestedSeconds).toBe(30);
    // The existing replay is still the one the coach has.
    expect(confirming.clip?.requestedSeconds).toBe(15);
  });

  it('keeps the existing replay when the coach cancels', () => {
    const kept = run([{ type: 'prepare', seconds: 30 }, { type: 'cancelReplace' }], readyWith(15));
    expect(kept.phase).toBe('ready');
    expect(kept.clip?.requestedSeconds).toBe(15);
    expect(kept.requestedSeconds).toBeNull();
  });

  it('starts a new prepare when confirmed, counted as a fresh attempt', () => {
    const ready = readyWith(15);
    const confirmed = run([{ type: 'prepare', seconds: 30 }, { type: 'confirmReplace' }], ready);
    expect(confirmed.phase).toBe('preparing');
    expect(confirmed.requestedSeconds).toBe(30);
    expect(confirmed.attempt).toBe(ready.attempt + 1);
  });

  it('takes the duration at confirmation time when Replace was used', () => {
    const confirming = pendingReplayReducer(readyWith(15), { type: 'replace' });
    expect(confirming.phase).toBe('confirmingReplace');
    expect(confirming.requestedSeconds).toBeNull();

    const confirmed = pendingReplayReducer(confirming, { type: 'confirmReplace', seconds: 30 });
    expect(confirmed.phase).toBe('preparing');
    expect(confirmed.requestedSeconds).toBe(30);
  });

  it('does nothing when a replace is confirmed without any duration', () => {
    const confirming = pendingReplayReducer(readyWith(15), { type: 'replace' });
    expect(pendingReplayReducer(confirming, { type: 'confirmReplace' })).toBe(confirming);
  });

  it('leaves the previous replay in place when the replacement fails', () => {
    const failed = run(
      [
        { type: 'prepare', seconds: 30 },
        { type: 'confirmReplace' },
        { type: 'prepareFailed', message: 'buffer restarted' },
      ],
      readyWith(15),
    );
    expect(failed.phase).toBe('ready');
    expect(failed.clip?.requestedSeconds).toBe(15);
    expect(failed.error).toBe('buffer restarted');
  });

  it('swaps in the new replay when the replacement succeeds', () => {
    const replaced = run(
      [
        { type: 'prepare', seconds: 30 },
        { type: 'confirmReplace' },
        { type: 'prepareSucceeded', clip: clip(30, '/cache/replay-2.mp4') },
      ],
      readyWith(15),
    );
    expect(replaced.clip?.path).toBe('/cache/replay-2.mp4');
    expect(replaced.clip?.requestedSeconds).toBe(30);
  });
});

describe('showing and clearing', () => {
  it('enters review only from ready', () => {
    expect(pendingReplayReducer(readyWith(15), { type: 'show' }).phase).toBe('reviewing');
    expect(pendingReplayReducer(initialPendingReplay, { type: 'show' }).phase).toBe('idle');
  });

  it('clears the replay on return to live, per the section 10 mitigation', () => {
    const afterReview = run([{ type: 'show' }, { type: 'returnToLive' }], readyWith(15));
    expect(afterReview.phase).toBe('idle');
    expect(afterReview.clip).toBeNull();
  });

  it('clears the replay on discard', () => {
    const discarded = pendingReplayReducer(readyWith(15), { type: 'discard' });
    expect(discarded.phase).toBe('idle');
    expect(discarded.clip).toBeNull();
  });

  it('clears everything when the session ends', () => {
    const ended = pendingReplayReducer(readyWith(30), { type: 'sessionEnded' });
    expect(ended.clip).toBeNull();
    expect(ended.phase).toBe('idle');
  });
});

describe('availability', () => {
  const idle = initialPendingReplay;

  it('requires that much continuous video first', () => {
    expect(canPrepare(idle, 15, 14.2, true)).toBe(false);
    expect(canPrepare(idle, 15, 15, true)).toBe(true);
    expect(canPrepare(idle, 30, 20, true)).toBe(false);
    expect(canPrepare(idle, 30, 31.5, true)).toBe(true);
  });

  it('is unavailable when the buffer is not running', () => {
    expect(canPrepare(idle, 15, 35, false)).toBe(false);
  });

  it('is unavailable while a prepare is in flight', () => {
    const preparing = pendingReplayReducer(idle, { type: 'prepare', seconds: 15 });
    expect(canPrepare(preparing, 15, 35, true)).toBe(false);
  });

  it('counts down the seconds still needed', () => {
    expect(secondsUntilAvailable(15, 0)).toBe(15);
    expect(secondsUntilAvailable(15, 12.3)).toBe(3);
    expect(secondsUntilAvailable(15, 15)).toBeNull();
    expect(secondsUntilAvailable(30, 31)).toBeNull();
  });
});

describe('modeLabelFor', () => {
  it('stays LIVE until Show Replay is used', () => {
    expect(modeLabelFor(initialPendingReplay)).toBe('LIVE');
    expect(modeLabelFor(readyWith(15))).toBe('LIVE');
  });

  it('names the requested window while reviewing', () => {
    const reviewing15 = pendingReplayReducer(readyWith(15), { type: 'show' });
    const reviewing30 = pendingReplayReducer(readyWith(30), { type: 'show' });
    expect(modeLabelFor(reviewing15)).toBe('REVIEWING LAST 15 SECONDS');
    expect(modeLabelFor(reviewing30)).toBe('REVIEWING LAST 30 SECONDS');
  });
});
