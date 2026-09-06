import { describeConnection } from './connectionStatus';

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
