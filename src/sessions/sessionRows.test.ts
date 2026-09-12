import { isJoinable, toSessionSummary, type SessionRow } from '@/sessions/sessionRows';

const row: SessionRow = {
  id: '5b0f8a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
  title: 'Footwork',
  student_name: null,
  scheduled_at: '2026-09-12T10:00:00.000Z',
  duration_minutes: 30,
  status: 'scheduled',
};

describe('isJoinable', () => {
  const session = toSessionSummary(row);

  it('keeps a session joinable through its post-session window', () => {
    expect(isJoinable(session, new Date('2026-09-12T11:29:00.000Z'))).toBe(true);
  });

  it('drops a session once its invitation has expired', () => {
    expect(isJoinable(session, new Date('2026-09-12T11:30:00.000Z'))).toBe(false);
  });

  it('drops an ended session immediately', () => {
    const ended = toSessionSummary({ ...row, status: 'ended' });
    expect(isJoinable(ended, new Date('2026-09-12T09:00:00.000Z'))).toBe(false);
  });
});
