import { describeConnection, replaySubscriptionQuality } from './connectionStatus';

describe('describeConnection', () => {
  it('reports progress while the call is being established', () => {
    expect(describeConnection('connecting', 'unknown')).toEqual({
      label: 'Connecting',
      tone: 'warning',
      isLive: false,
    });
  });

  it('treats both reconnecting states the same way', () => {
    expect(describeConnection('reconnecting', 'unknown').label).toBe('Reconnecting');
    expect(describeConnection('signalReconnecting', 'unknown').label).toBe('Reconnecting');
  });

  it('surfaces weak connections without ending the call', () => {
    const status = describeConnection('connected', 'poor');
    expect(status).toEqual({ label: 'Weak connection', tone: 'warning', isLive: true });
  });

  it('stays live when quality is lost so the call is not torn down', () => {
    expect(describeConnection('connected', 'lost').isLive).toBe(true);
  });

  it('reads as connected for good and unknown quality alike', () => {
    expect(describeConnection('connected', 'excellent').tone).toBe('good');
    expect(describeConnection('connected', 'unknown').tone).toBe('good');
  });

  it('falls back to not connected for unrecognised states', () => {
    expect(describeConnection('something-new', 'unknown')).toEqual({
      label: 'Not connected',
      tone: 'bad',
      isLive: false,
    });
  });
});

describe('replaySubscriptionQuality', () => {
  it('asks for the highest layer while the connection is healthy (D-012)', () => {
    expect(replaySubscriptionQuality('good')).toBe('high');
  });

  it('releases the pin as soon as the connection is not healthy (NFR-06)', () => {
    // Live video the lesson depends on outranks replay sharpness.
    expect(replaySubscriptionQuality('warning')).toBe('low');
    expect(replaySubscriptionQuality('bad')).toBe('low');
  });

  it('follows the tone already shown to the user, so the two cannot disagree', () => {
    expect(replaySubscriptionQuality(describeConnection('connected', 'excellent').tone)).toBe(
      'high',
    );
    expect(replaySubscriptionQuality(describeConnection('connected', 'poor').tone)).toBe('low');
    expect(replaySubscriptionQuality(describeConnection('reconnecting', 'unknown').tone)).toBe(
      'low',
    );
  });
});
