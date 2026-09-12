import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { ApiError, coachSessions } from '@/backend/api';
import { supabase } from '@/backend/supabase';
import { CallScreen } from '@/call/CallScreen';
import { SessionEndedScreen } from '@/call/components/SessionEndedScreen';
import { PreCallCheck, type PreCallChoice } from '@/precall/PreCallCheck';
import { describeSchedule } from '@/sessions/schedule';
import { isJoinable, SESSION_COLUMNS, toSessionSummary } from '@/sessions/sessionRows';
import type { SessionSummary } from '@shared/contract';

type Phase = { name: 'check' } | { name: 'call'; choice: PreCallChoice } | { name: 'ended' };

/** The coach's way into a session: pre-call check, the call, then Session ended. */
export default function CoachSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const [phase, setPhase] = useState<Phase>({ name: 'check' });
  const [session, setSession] = useState<SessionSummary | null>(null);

  /**
   * Reads the session through RLS. That one round trip proves the backend is
   * reachable and the coach is still signed in, and catches a session that has
   * ended since the dashboard was loaded.
   */
  const checkConnection = useCallback(async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select(SESSION_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new ApiError('network');
    }
    if (!data) {
      throw new ApiError('not_found');
    }
    const summary = toSessionSummary(data);
    setSession(summary);
    if (summary.status === 'ended') {
      throw new ApiError('session_ended');
    }
    if (!isJoinable(summary, new Date())) {
      throw new ApiError('session_expired');
    }
  }, [id]);

  const fetchCredentials = useCallback(
    () => coachSessions.join(id, { consentAccepted: true }),
    [id],
  );

  const endSession = useCallback(async () => {
    await coachSessions.end(id);
  }, [id]);

  const showEnded = useCallback(() => setPhase({ name: 'ended' }), []);
  const toDashboard = useCallback(() => router.replace('/dashboard'), []);

  if (auth.status === 'signedOut') {
    return <Redirect href="/" />;
  }

  if (phase.name === 'ended') {
    return <SessionEndedScreen actionLabel="Back to sessions" onDone={toDashboard} />;
  }

  if (phase.name === 'call') {
    return (
      <CallScreen
        role="coach"
        fetchCredentials={fetchCredentials}
        facingMode={phase.choice.facingMode}
        audioOutput={phase.choice.audioOutput}
        onEndSession={endSession}
        onEnded={showEnded}
        onExit={toDashboard}
      />
    );
  }

  return (
    <PreCallCheck
      role="coach"
      heading={session?.title ?? 'Get ready'}
      details={
        session
          ? `${describeSchedule(new Date(session.scheduledAt), session.durationMinutes)}${
              session.studentName ? ` · with ${session.studentName}` : ''
            }`
          : undefined
      }
      checkConnection={checkConnection}
      requireConsent
      onJoin={(choice) => setPhase({ name: 'call', choice })}
      onBack={toDashboard}
    />
  );
}
