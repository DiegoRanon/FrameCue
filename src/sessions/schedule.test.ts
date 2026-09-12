import {
  defaultStartTime,
  describeSchedule,
  relativeDay,
  withDate,
  withTime,
} from '@/sessions/schedule';

// Local-time constructors throughout: these helpers work in the device's zone.
const local = (hours: number, minutes: number, seconds = 0, day = 12) =>
  new Date(2026, 8, day, hours, minutes, seconds);

describe('defaultStartTime', () => {
  it('rounds up to the next half hour', () => {
    expect(defaultStartTime(local(9, 10, 42))).toEqual(local(9, 30));
  });

  it('rounds up to the next hour after the half hour', () => {
    expect(defaultStartTime(local(9, 45))).toEqual(local(10, 0));
  });

  it('never returns the current instant, even on a boundary', () => {
    expect(defaultStartTime(local(9, 30))).toEqual(local(10, 0));
    expect(defaultStartTime(local(9, 0))).toEqual(local(9, 30));
  });

  it('rolls over to the next day', () => {
    expect(defaultStartTime(local(23, 50))).toEqual(local(0, 0, 0, 13));
  });
});

describe('withDate and withTime', () => {
  it('combines the two halves of the Android pickers', () => {
    const base = local(9, 30);
    expect(withDate(base, local(18, 5, 0, 20))).toEqual(local(9, 30, 0, 20));
    expect(withTime(base, local(18, 5, 59, 20))).toEqual(local(18, 5));
  });
});

describe('relativeDay', () => {
  it('names today and tomorrow only', () => {
    const now = local(22, 0);
    expect(relativeDay(local(8, 0), now)).toBe('Today');
    expect(relativeDay(local(8, 0, 0, 13), now)).toBe('Tomorrow');
    expect(relativeDay(local(8, 0, 0, 14), now)).toBeNull();
    expect(relativeDay(local(8, 0, 0, 11), now)).toBeNull();
  });
});

describe('describeSchedule', () => {
  it('leads with a relative day and ends with the duration', () => {
    const copy = describeSchedule(local(14, 30), 45, local(9, 0));
    expect(copy.startsWith('Today, ')).toBe(true);
    expect(copy.endsWith(' · 45 min')).toBe(true);
  });
});
