import { describeDisconnect } from '@/call/disconnectStatus';

// livekit.DisconnectReason, by value.
const CLIENT_INITIATED = 1;
const DUPLICATE_IDENTITY = 2;
const SERVER_SHUTDOWN = 3;
const PARTICIPANT_REMOVED = 4;
const ROOM_DELETED = 5;
const STATE_MISMATCH = 6;
const JOIN_FAILURE = 7;
const SIGNAL_CLOSE = 9;

describe('describeDisconnect', () => {
  it('reports nothing when the participant left on purpose', () => {
    expect(describeDisconnect(CLIENT_INITIATED)).toBeNull();
  });

  it('offers a rejoin for a dropped connection', () => {
    const status = describeDisconnect(SIGNAL_CLOSE);
    expect(status?.canRejoin).toBe(true);
    expect(status?.title).toBe('Connection lost');
  });

  it('treats an unknown or absent reason as recoverable', () => {
    // AC-14 asks for a recoverable state; assuming the worst would strand a
    // lesson over a reason this build has never seen.
    expect(describeDisconnect(undefined)?.canRejoin).toBe(true);
    expect(describeDisconnect(STATE_MISMATCH)?.canRejoin).toBe(true);
    expect(describeDisconnect(9999)?.canRejoin).toBe(true);
  });

  it('does not offer a rejoin once the session itself is gone', () => {
    expect(describeDisconnect(PARTICIPANT_REMOVED)?.canRejoin).toBe(false);
    expect(describeDisconnect(ROOM_DELETED)?.canRejoin).toBe(false);
  });

  it('marks a deleted room as the end of the session, not an error (FR-17)', () => {
    expect(describeDisconnect(ROOM_DELETED)?.ended).toBe(true);
    expect(describeDisconnect(PARTICIPANT_REMOVED)?.ended).toBe(true);
    for (const reason of [undefined, DUPLICATE_IDENTITY, SERVER_SHUTDOWN, JOIN_FAILURE]) {
      expect(describeDisconnect(reason)?.ended).toBe(false);
    }
  });

  it('explains a duplicate join rather than looping the user back in', () => {
    const status = describeDisconnect(DUPLICATE_IDENTITY);
    expect(status?.title).toBe('Joined somewhere else');
    expect(status?.canRejoin).toBe(true);
  });

  it('distinguishes a server-side close from a failed join', () => {
    expect(describeDisconnect(SERVER_SHUTDOWN)?.title).toBe('Session interrupted');
    expect(describeDisconnect(JOIN_FAILURE)?.title).toBe('Could not join');
  });

  it('never leaks a reason code or jargon into the copy (FR-18)', () => {
    for (const reason of [undefined, DUPLICATE_IDENTITY, SERVER_SHUTDOWN, JOIN_FAILURE, 9999]) {
      const status = describeDisconnect(reason);
      const copy = `${status?.title} ${status?.body}`;
      expect(copy).not.toMatch(/\d/);
      expect(copy.toLowerCase()).not.toMatch(/websocket|signal|rtc|token|peer connection|socket/);
    }
  });
});
