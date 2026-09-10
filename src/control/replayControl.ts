import { z } from 'zod';

import type { ReplayRate } from '@/replay/playerCommands';

/**
 * The wire protocol for synchronized replay review (spec sections 3.1.5-3.1.8,
 * NFR-02).
 *
 * The coach is authoritative: every message describes what the coach's own
 * player is doing, and the student's player is steered to match. Nothing flows
 * the other way - the student never sends on this topic.
 *
 * Two topics, deliberately separate:
 *
 * - Control messages go out as reliable data packets, which are small, ordered,
 *   and arrive in a single round trip.
 * - The clip itself goes over a byte stream on its own topic, so a 5 MB
 *   transfer cannot delay a Pause the coach just pressed.
 */
export const REPLAY_CONTROL_TOPIC = 'framecue.replay.control';
export const REPLAY_CLIP_TOPIC = 'framecue.replay.clip';

/** Bumped only on a breaking change; a mismatch is ignored, never guessed at. */
export const REPLAY_PROTOCOL_VERSION = 1;

const playbackStateSchema = z.object({
  positionSeconds: z.number().min(0),
  playing: z.boolean(),
  rate: z.union([z.literal(0.5), z.literal(1)]),
});

/** What the coach's player is doing, as of `sentAtMs`. */
export type PlaybackState = z.infer<typeof playbackStateSchema>;

/**
 * `show` starts review; `sync` is the periodic heartbeat that keeps a follower
 * inside the drift budget; the rest are the coach's `ReplayCommand` vocabulary
 * (FR-11) named so a log line says what the coach actually pressed.
 */
export const CLIP_MESSAGE_TYPES = [
  'show',
  'play',
  'pause',
  'seek',
  'restart',
  'rate',
  'sync',
] as const;

const clipMessageSchema = z.object({
  v: z.literal(REPLAY_PROTOCOL_VERSION),
  type: z.enum(CLIP_MESSAGE_TYPES),
  clipId: z.string().min(1),
  /** Carried on every message so a student who missed `show` can still label the screen. */
  requestedSeconds: z.union([z.literal(15), z.literal(30)]),
  /**
   * The coach's clock when the message was sent. Used to discard a message
   * that arrives after a newer one, not to compute elapsed time - the two
   * devices' clocks are unrelated, so the follower measures elapsed time
   * against its own arrival time instead (see `followerSync.ts`).
   */
  sentAtMs: z.number().int().nonnegative(),
  state: playbackStateSchema,
});

const returnLiveMessageSchema = z.object({
  v: z.literal(REPLAY_PROTOCOL_VERSION),
  type: z.literal('returnLive'),
  sentAtMs: z.number().int().nonnegative(),
});

const replayControlMessageSchema = z.union([clipMessageSchema, returnLiveMessageSchema]);

export type ClipMessageType = (typeof CLIP_MESSAGE_TYPES)[number];
export type ClipMessage = z.infer<typeof clipMessageSchema>;
export type ReturnLiveMessage = z.infer<typeof returnLiveMessageSchema>;
export type ReplayControlMessage = z.infer<typeof replayControlMessageSchema>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * The `ArrayBuffer` type argument is not decoration: LiveKit's `publishData`
 * refuses a possibly-shared buffer, and `TextEncoder` already guarantees an
 * unshared one.
 */
export function encodeReplayControl(message: ReplayControlMessage): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify(message));
}

/**
 * `null` for anything that is not a control message this build understands -
 * malformed JSON, a future protocol version, a type we do not know.
 *
 * A replay failure must never take the live call with it (NFR-04), and a
 * control message is the one place a peer can hand us arbitrary bytes, so this
 * refuses rather than throws.
 */
export function decodeReplayControl(payload: Uint8Array): ReplayControlMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(payload));
  } catch {
    return null;
  }
  const result = replayControlMessageSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

type ClipMessageInput = {
  type: ClipMessageType;
  clipId: string;
  requestedSeconds: 15 | 30;
  positionSeconds: number;
  playing: boolean;
  rate: ReplayRate;
};

/** Builds a clip message stamped with the coach's clock. */
export function clipMessage(input: ClipMessageInput): ClipMessage {
  return {
    v: REPLAY_PROTOCOL_VERSION,
    type: input.type,
    clipId: input.clipId,
    requestedSeconds: input.requestedSeconds,
    sentAtMs: Date.now(),
    state: {
      // A player that has not loaded reports NaN; never put that on the wire.
      positionSeconds: Number.isFinite(input.positionSeconds)
        ? Math.max(input.positionSeconds, 0)
        : 0,
      playing: input.playing,
      rate: input.rate,
    },
  };
}

export function returnLiveMessage(): ReturnLiveMessage {
  return { v: REPLAY_PROTOCOL_VERSION, type: 'returnLive', sentAtMs: Date.now() };
}
