/**
 * Turns a LiveKit disconnect into something a coach or student can act on
 * (FR-18, AC-14: a dropped connection produces a *recoverable* error state).
 *
 * Takes the raw numeric reason rather than the protocol enum, for the same
 * reason `connectionStatus.ts` takes plain strings: the mapping stays pure and
 * testable without pulling the LiveKit client into a unit test.
 */
export type DisconnectStatus = {
  title: string;
  body: string;
  /** Whether offering a Rejoin button makes sense, or only a way out. */
  canRejoin: boolean;
};

/**
 * Mirrors `livekit.DisconnectReason`. Only the values this app reacts to
 * differently are named; everything else falls through to the recoverable
 * default, which is the safer assumption for a lesson in progress.
 */
const REASON = {
  UNKNOWN: 0,
  CLIENT_INITIATED: 1,
  DUPLICATE_IDENTITY: 2,
  SERVER_SHUTDOWN: 3,
  PARTICIPANT_REMOVED: 4,
  ROOM_DELETED: 5,
  JOIN_FAILURE: 7,
} as const;

/**
 * `null` means the session ended on purpose - the participant pressed Leave -
 * so there is nothing to report and no error screen to show.
 */
export function describeDisconnect(reason?: number): DisconnectStatus | null {
  switch (reason) {
    case REASON.CLIENT_INITIATED:
      return null;

    case REASON.DUPLICATE_IDENTITY:
      return {
        title: 'Joined somewhere else',
        body: 'This session was opened on another device using the same link. Only one device can be in a session at a time.',
        canRejoin: true,
      };

    case REASON.PARTICIPANT_REMOVED:
    case REASON.ROOM_DELETED:
      return {
        title: 'Session ended',
        body: 'The session has been ended. Nothing from it was saved.',
        canRejoin: false,
      };

    case REASON.SERVER_SHUTDOWN:
      return {
        title: 'Session interrupted',
        body: 'The connection was closed at the other end. Rejoining usually works straight away.',
        canRejoin: true,
      };

    case REASON.JOIN_FAILURE:
      return {
        title: 'Could not join',
        body: 'The session could not be joined. Check the connection and try again.',
        canRejoin: true,
      };

    default:
      return {
        title: 'Connection lost',
        body: 'The connection to the session dropped. Rejoining will restore the live call.',
        canRejoin: true,
      };
  }
}
