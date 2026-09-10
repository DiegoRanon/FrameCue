import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useCallback, useEffect, useRef } from 'react';

import {
  decodeReplayControl,
  encodeReplayControl,
  REPLAY_CONTROL_TOPIC,
  type ReplayControlMessage,
} from '@/control/replayControl';

/**
 * Transport for the replay control protocol.
 *
 * Reliable data packets rather than a data stream: each message is a few
 * hundred bytes, ordering matters, and a packet arrives in one round trip
 * instead of a stream's header-then-chunks-then-trailer sequence (NFR-02).
 *
 * Messages are broadcast rather than addressed. A FrameCue session has exactly
 * one coach and one student (spec section 5.1), so "everyone else" is the
 * student, and not depending on a resolved participant identity removes a way
 * for a Show Replay to silently go nowhere.
 */
export function useReplayControlSender(): (message: ReplayControlMessage) => void {
  const room = useRoomContext();

  return useCallback(
    (message: ReplayControlMessage) => {
      void room.localParticipant
        .publishData(encodeReplayControl(message), {
          reliable: true,
          topic: REPLAY_CONTROL_TOPIC,
        })
        // A dropped control message is corrected by the next heartbeat, and
        // must never surface as a call failure (NFR-04).
        .catch(() => undefined);
    },
    [room],
  );
}

/** Delivers decoded control messages; anything unrecognised is dropped silently. */
export function useReplayControlListener(onMessage: (message: ReplayControlMessage) => void): void {
  const room = useRoomContext();

  // Kept in a ref so a new callback identity does not re-register the room
  // listener, which would drop messages arriving during the swap.
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const listener = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== REPLAY_CONTROL_TOPIC) {
        return;
      }
      const message = decodeReplayControl(payload);
      if (message) {
        handlerRef.current(message);
      }
    };

    room.on(RoomEvent.DataReceived, listener);
    return () => {
      room.off(RoomEvent.DataReceived, listener);
    };
  }, [room]);
}
