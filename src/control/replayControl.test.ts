import {
  clipMessage,
  decodeReplayControl,
  encodeReplayControl,
  REPLAY_PROTOCOL_VERSION,
  returnLiveMessage,
  type ReplayControlMessage,
} from '@/control/replayControl';

const encoder = new TextEncoder();

function wire(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function roundTrip(message: ReplayControlMessage): ReplayControlMessage | null {
  return decodeReplayControl(encodeReplayControl(message));
}

describe('replay control messages', () => {
  it('round-trips a show message', () => {
    const message = clipMessage({
      type: 'show',
      clipId: 'clip-1',
      requestedSeconds: 15,
      positionSeconds: 0,
      playing: false,
      rate: 1,
    });

    expect(roundTrip(message)).toEqual(message);
  });

  it('round-trips every command the coach can issue', () => {
    for (const type of ['play', 'pause', 'seek', 'restart', 'rate', 'sync'] as const) {
      const message = clipMessage({
        type,
        clipId: 'clip-1',
        requestedSeconds: 30,
        positionSeconds: 4.25,
        playing: true,
        rate: 0.5,
      });

      expect(roundTrip(message)).toEqual(message);
    }
  });

  it('round-trips return to live', () => {
    expect(roundTrip(returnLiveMessage())).toEqual(expect.objectContaining({ type: 'returnLive' }));
  });

  it('never puts a non-finite position on the wire', () => {
    // An expo-video player reports NaN until its source has loaded.
    const message = clipMessage({
      type: 'sync',
      clipId: 'clip-1',
      requestedSeconds: 15,
      positionSeconds: Number.NaN,
      playing: false,
      rate: 1,
    });

    expect(message.state.positionSeconds).toBe(0);
  });

  it('rejects malformed payloads instead of throwing', () => {
    expect(decodeReplayControl(encoder.encode('not json'))).toBeNull();
    expect(decodeReplayControl(wire(null))).toBeNull();
    expect(decodeReplayControl(wire({}))).toBeNull();
    expect(decodeReplayControl(new Uint8Array([0xff, 0xfe, 0x00]))).toBeNull();
  });

  it('rejects a message from a different protocol version', () => {
    const message = clipMessage({
      type: 'play',
      clipId: 'clip-1',
      requestedSeconds: 15,
      positionSeconds: 1,
      playing: true,
      rate: 1,
    });

    expect(decodeReplayControl(wire({ ...message, v: REPLAY_PROTOCOL_VERSION + 1 }))).toBeNull();
  });

  it('rejects unknown types, missing clip ids, and out-of-range values', () => {
    const message = clipMessage({
      type: 'play',
      clipId: 'clip-1',
      requestedSeconds: 15,
      positionSeconds: 1,
      playing: true,
      rate: 1,
    });

    expect(decodeReplayControl(wire({ ...message, type: 'delete' }))).toBeNull();
    expect(decodeReplayControl(wire({ ...message, clipId: '' }))).toBeNull();
    expect(decodeReplayControl(wire({ ...message, requestedSeconds: 45 }))).toBeNull();
    expect(
      decodeReplayControl(wire({ ...message, state: { ...message.state, rate: 2 } })),
    ).toBeNull();
    expect(
      decodeReplayControl(wire({ ...message, state: { ...message.state, positionSeconds: -1 } })),
    ).toBeNull();
  });
});
