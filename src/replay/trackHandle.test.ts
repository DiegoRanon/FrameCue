import { sameHandle, trackHandleFor } from './trackHandle';

describe('trackHandleFor', () => {
  it('reads the ids the native buffer needs from a remote track', () => {
    const trackRef = {
      publication: { track: { mediaStreamTrack: { id: 'abc', _peerConnectionId: 7 } } },
    };
    expect(trackHandleFor(trackRef)).toEqual({ peerConnectionId: 7, trackId: 'abc' });
  });

  it('treats a track without a peer connection id as local', () => {
    const trackRef = { publication: { track: { mediaStreamTrack: { id: 'local-1' } } } };
    expect(trackHandleFor(trackRef)).toEqual({ peerConnectionId: -1, trackId: 'local-1' });
  });

  it('returns null while the track is not subscribed yet', () => {
    expect(trackHandleFor(undefined)).toBeNull();
    expect(trackHandleFor({ publication: null })).toBeNull();
    expect(trackHandleFor({ publication: { track: null } })).toBeNull();
    expect(trackHandleFor({ publication: { track: { mediaStreamTrack: {} } } })).toBeNull();
  });
});

describe('sameHandle', () => {
  it('compares by both identifiers', () => {
    const handle = { peerConnectionId: 1, trackId: 'a' };
    expect(sameHandle(handle, { peerConnectionId: 1, trackId: 'a' })).toBe(true);
    expect(sameHandle(handle, { peerConnectionId: 2, trackId: 'a' })).toBe(false);
    expect(sameHandle(handle, { peerConnectionId: 1, trackId: 'b' })).toBe(false);
  });

  it('handles the not-yet-subscribed case', () => {
    expect(sameHandle(null, null)).toBe(true);
    expect(sameHandle(null, { peerConnectionId: 1, trackId: 'a' })).toBe(false);
  });
});
