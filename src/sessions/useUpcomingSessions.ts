import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '@/backend/supabase';
import { isJoinable, SESSION_COLUMNS, toSessionSummary } from '@/sessions/sessionRows';
import type { SessionSummary } from '@shared/contract';

export type UpcomingSessions = {
  /** `null` until the first load finishes. */
  sessions: SessionSummary[] | null;
  error: string | null;
  refreshing: boolean;
  refresh: () => void;
};

/**
 * The coach's sessions that can still be joined, soonest first. RLS returns
 * only this coach's rows (FR-01); ended and expired sessions are dropped by the
 * same rule the backend applies.
 */
export function useUpcomingSessions(): UpcomingSessions {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('sessions')
      .select(SESSION_COLUMNS)
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true });
    if (queryError) {
      setError('Your sessions could not be loaded. Pull down to try again.');
      return;
    }
    const now = new Date();
    setError(null);
    setSessions(data.map(toSessionSummary).filter((session) => isJoinable(session, now)));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  // Reloads whenever the dashboard comes back into view: after creating a
  // session, and after ending one.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { sessions, error, refreshing, refresh };
}
