/**
 * Date and time helpers for Create Session and the dashboard. Everything is in
 * the device's own time zone and locale; the backend stores UTC.
 */

/**
 * The next half-hour boundary strictly after `now`. Lessons tend to start on
 * the hour or the half hour, so a coach creating one for later today usually
 * only has to type a title (AC-01).
 */
export function defaultStartTime(now: Date): Date {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(now.getMinutes() < 30 ? 30 : 60);
  return next;
}

/** The calendar day from `date`, the clock time from `base`: Android's date picker. */
export function withDate(base: Date, date: Date): Date {
  const result = new Date(base);
  result.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return result;
}

/** The clock time from `time`, the calendar day from `base`: Android's time picker. */
export function withTime(base: Date, time: Date): Date {
  const result = new Date(base);
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}

export function relativeDay(date: Date, now: Date): 'Today' | 'Tomorrow' | null {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  // Rounded, because a day that crosses a daylight-saving change is 23 or 25 hours.
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days === 0) {
    return 'Today';
  }
  return days === 1 ? 'Tomorrow' : null;
}

/** "Today, 2:30 PM · 45 min", in the device's locale. */
export function describeSchedule(
  scheduledAt: Date,
  durationMinutes: number,
  now: Date = new Date(),
): string {
  const time = scheduledAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const day =
    relativeDay(scheduledAt, now) ??
    scheduledAt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${time} · ${durationMinutes} min`;
}
