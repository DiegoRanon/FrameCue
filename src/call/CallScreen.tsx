import { AudioSession, LiveKitRoom } from '@livekit/react-native';
import { useCallback, useEffect, useState } from 'react';

import { CoachLiveView } from '@/call/CoachLiveView';
import { MessageScreen } from '@/call/components/MessageScreen';
import { requestCallPermissions } from '@/call/permissions';
import type { CallRole } from '@/call/roles';
import { callRoomOptions } from '@/call/roomOptions';
import { StudentLiveView } from '@/call/StudentLiveView';
import { livekitConfigFor, missingLivekitConfig } from '@/config/env';

type Phase = 'checking' | 'denied' | 'ready';

/**
 * Everything that has to be true before media can flow: configuration present,
 * camera and microphone granted, audio session started. Only then is the room
 * connected, so the live views can assume a working call.
 */
export function CallScreen({ role, onExit }: { role: CallRole; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [missingPermissions, setMissingPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const config = livekitConfigFor(role);

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

  const retryPermissions = useCallback(() => {
    setPhase('checking');
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (phase !== 'ready') {
      return;
    }
    // Routes audio to the speaker and sets the call audio mode. Must be
    // running before the room connects, and stopped when leaving so the
    // device returns to normal audio behaviour.
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, [phase]);

  if (!config) {
    return (
      <MessageScreen
        title="Not configured yet"
        body="Add the LiveKit values to .env and restart the app. See .env.example for how to generate a token."
        details={missingLivekitConfig(role).map((name) => `${name} is missing`)}
        primaryAction={{ label: 'Back', onPress: onExit }}
      />
    );
  }

  if (error) {
    return (
      <MessageScreen
        title="Could not join"
        body="The session could not be joined. Check the connection and the token, then try again."
        details={[error]}
        primaryAction={{ label: 'Try again', onPress: () => setError(null) }}
        secondaryAction={{ label: 'Back', onPress: onExit }}
      />
    );
  }

  if (phase === 'checking') {
    return <MessageScreen title="Getting ready" body="Checking camera and microphone access." />;
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

  return (
    <LiveKitRoom
      serverUrl={config.url}
      token={config.token}
      connect
      audio
      video
      options={callRoomOptions}
      onError={(caught) => setError(caught.message)}
    >
      {role === 'coach' ? <CoachLiveView onLeave={onExit} /> : <StudentLiveView onLeave={onExit} />}
    </LiveKitRoom>
  );
}
