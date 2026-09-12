import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

import type { CallCredentials } from '../contract.ts';
import { logFailure, requireEnv } from './http.ts';

/**
 * Short-lived on purpose (NFR-08). A token only has to be valid at the moment
 * of connecting: LiveKit refreshes it for a participant who stays connected,
 * and Rejoin asks for a new one.
 */
const TOKEN_TTL_SECONDS = 10 * 60;

export async function mintCallCredentials(participant: {
  identity: string;
  name: string;
  room: string;
}): Promise<CallCredentials> {
  const accessToken = new AccessToken(
    requireEnv('LIVEKIT_API_KEY'),
    requireEnv('LIVEKIT_API_SECRET'),
    { identity: participant.identity, name: participant.name, ttl: TOKEN_TTL_SECONDS },
  );
  // Exactly what a live lesson needs. No roomAdmin and no roomRecord, so no
  // participant can start egress or a recording (NFR-09).
  accessToken.addGrant({
    room: participant.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return { livekitUrl: requireEnv('LIVEKIT_URL'), token: await accessToken.toJwt() };
}

/**
 * Disconnects everyone in the room (FR-17). A room that no longer exists counts
 * as closed; `false` means LiveKit could not be reached.
 */
export async function closeRoom(room: string): Promise<boolean> {
  const host = requireEnv('LIVEKIT_URL').replace(/^ws(s?):\/\//, 'http$1://');
  const client = new RoomServiceClient(
    host,
    requireEnv('LIVEKIT_API_KEY'),
    requireEnv('LIVEKIT_API_SECRET'),
  );
  try {
    await client.deleteRoom(room);
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return true;
    }
    logFailure('livekit.deleteRoom', error);
    return false;
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return (
    ('status' in error && error.status === 404) || ('code' in error && error.code === 'not_found')
  );
}
