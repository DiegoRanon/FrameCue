import { clearAll } from '@modules/replay-buffer';

import { clearReceivedClips } from '@/replay/clipTransfer';

/**
 * Wipes every temporary replay the moment the app starts (FR-16, AC-12).
 *
 * A force-close or a crash is the one path that skips all the ordinary cleanup,
 * so the guarantee that "reopening the invitation cannot recover it" has to be
 * enforced on the way in as well as on the way out.
 *
 * Both sides are cleared regardless of role, because a device can be the coach
 * in one session and the student in the next:
 *
 * - the native module's own clip directory, which also releases any encoder and
 *   empties the ring buffer;
 * - the cache directory holding clips this device received as the student.
 *
 * A module side effect rather than an effect in a component, so it cannot be
 * skipped by a route that renders first, and it runs exactly once. Failures are
 * swallowed: an unreadable cache directory must not stop the app from starting.
 */
void clearAll().catch(() => undefined);

try {
  clearReceivedClips();
} catch {
  // Nothing to do - the directory is unreachable, which is the desired state.
}
