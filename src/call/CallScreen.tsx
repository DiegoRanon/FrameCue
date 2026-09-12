import { AudioSession, LiveKitRoom } from '@livekit/react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, describeApiError } from '@/backend/api';
import { CoachLiveView } from '@/call/CoachLiveView';
import { MessageScreen } from '@/call/components/MessageScreen';
import { describeDisconnect, type DisconnectStatus } from '@/call/disconnectStatus';
import { requestCallPermissions } from '@/call/permissions';
import type { CallRole } from '@/call/roles';
import { callRoomOptions, type FacingMode } from '@/call/roomOptions';
import { StudentLiveView } from '@/call/StudentLiveView';
import type { CallCredentials } from '@shared/contract';

type Phase = 'checking' | 'denied' | 'ready';

type CallScreenProps = {
  role: CallRole;
  /**
   * Called on every join attempt. Credentials are short-lived (NFR-08), so a
   * Rejoin must never reuse the ones from the first connection.
   */
  fetchCredentials: () => Promise<CallCredentials>;
  facingMode: FacingMode;
  /** The output chosen in the pre-call check, or null for the default route. */
  audioOutput: string | null;
  /** Coach only: ends the session for both participants (FR-17). */
  onEndSession?: () => Promise<void>;
  /** The session is over - ended by the coach, or no longer joinable. */
  onEnded: () => void;
  onExit: () => void;
};

/**
 * Everything that has to be true before media can flow: camera and microphone
 * granted, credentials issued by the backend, audio session started. Only then
 * is the room connected, so the live views can assume a working call.
 */
export function CallScreen({
  role,
  fetchCredentials,
  facingMode,
  audioOutput,
  onEndSession,
  onEnded,
  onExit,
}: CallScreenProps) {
  // A student on a tripod never touches the screen, so the device would sleep
  // mid-drill and take the video with it. Held for the whole call screen and
  // released automatically when it unmounts.
  useKeepAwake();

  const [phase, setPhase] = useState<Phase>('checking');
  const [missingPermissions, setMissingPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [dropped, setDropped] = useState<DisconnectStatus | null>(null);
  // Changing this refetches credentials and remounts LiveKitRoom, which is how
  // Rejoin reconnects without sending the user back out of the session.
  const [joinAttempt, setJoinAttempt] = useState(0);
  // Tagged with the attempt they were fetched for, so stale credentials are
  // never used for a newer attempt.
  const [credentials, setCredentials] = useState<{
    attempt: number;
    value: CallCredentials;
  } | null>(null);

  const roomOptions = useMemo(() => callRoomOptions(facingMode), [facingMode]);

  useEffect(() => {
    let cancelled = false;
    void requestCallPermissions().then((result) => {
      if (cancelled) {
        return;
      }
      setMissingPermissions(result.missing);
      setPhase(result.granted ? 'ready' : 'denied');
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (phase !== 'ready') {
      return;
    }
    let cancelled = false;
    fetchCredentials()
      .then((value) => {
        if (!cancelled) {
          setCredentials({ attempt: joinAttempt, value });
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        if (
          caught instanceof ApiError &&
          (caught.code === 'session_ended' || caught.code === 'session_expired')
        ) {
          onEnded();
          return;
        }
        setError(describeApiError(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCredentials, joinAttempt, onEnded, phase]);

  const retryPermissions = useCallback(() => {
    setPhase('checking');
    setAttempt((value) => value + 1);
  }, []);

  /**
   * AC-14: a dropped connection is a recoverable state, not a dead end. The
   * live views unmount when this renders, which is what tears down the replay
   * buffer and deletes any clip (FR-16). A deleted room is different: the
   * coach ended the session, so there is nothing to rejoin.
   */
  const onDisconnected = useCallback(
    (reason?: number) => {
      const status = describeDisconnect(reason);
      if (status?.ended) {
        onEnded();
        return;
      }
      setDropped(status);
    },
    [onEnded],
  );

  const rejoin = useCallback(() => {
    setDropped(null);
    setError(null);
    setJoinAttempt((value) => value + 1);
  }, []);

  const endSession = useMemo(
    () =>
      onEndSession
        ? async () => {
            await onEndSession();
            // Unmounting the room disconnects this device even if LiveKit could
            // not be told to close the room.
            onEnded();
          }
        : undefined,
    [onEndSession, onEnded],
  );

  useEffect(() => {
    if (phase !== 'ready') {
      return;
    }
    // Routes audio to the speaker and sets the call audio mode. Must be
    // running before the room connects, and stopped when leaving so the
    // device returns to normal audio behaviour.
    AudioSession.startAudioSession()
      .then(() => (audioOutput ? AudioSession.selectAudioOutput(audioOutput) : undefined))
      .catch(() => undefined);
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, [audioOutput, phase]);

  if (error) {
    return (
      <MessageScreen
        title="Could not join"
        body={error}
        primaryAction={{ label: 'Try again', onPress: rejoin }}
        secondaryAction={{ label: 'Back', onPress: onExit }}
      />
    );
  }

  if (phase === 'checking') {
    return <MessageScreen title="Getting ready" body="Checking camera and microphone access." />;
  }

  if (dropped) {
    return (
      <MessageScreen
        title={dropped.title}
        body={dropped.body}
        primaryAction={dropped.canRejoin ? { label: 'Rejoin', onPress: rejoin } : undefined}
        secondaryAction={{ label: 'Back', onPress: onExit }}
      />
    );
  }

  if (phase === 'denied') {
    return (
      <MessageScreen
        title="Camera and microphone needed"
        body="A coaching session needs both. Grant access to continue, or enable it in system settings if the prompt no longer appears."
        details={missingPermissions.map((name) => `${name} access denied`)}
        primaryAction={{ label: 'Try again', onPress: retryPermissions }}
        secondaryAction={{ label: 'Back', onPress: onExit }}
      />
    );
  }

  const current = credentials?.attempt === joinAttempt ? credentials.value : null;
  if (!current) {
    return <MessageScreen title="Joining" body="Connecting to the session…" />;
  }

  return (
    <LiveKitRoom
      key={joinAttempt}
      serverUrl={current.livekitUrl}
      token={current.token}
      connect
      audio
      video
      options={roomOptions}
      onError={() =>
        setError('The live call could not be started. Check the connection and try again.')
      }
      onDisconnected={onDisconnected}
    >
      {role === 'coach' ? (
        <CoachLiveView onLeave={onExit} onEndSession={endSession} />
      ) : (
        <StudentLiveView onLeave={onExit} />
      )}
    </LiveKitRoom>
  );
}
