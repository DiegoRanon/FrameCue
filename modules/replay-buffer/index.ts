import { requireOptionalNativeModule } from 'expo';

/**
 * The coach-side rolling replay buffer.
 *
 * Android only for now; the iOS implementation lands in M8 behind this same
 * interface (see docs/DECISIONS.md D-006). Every function is a no-op-free
 * contract: callers check `isReplayBufferAvailable` first.
 */
export type ReplayBufferStatus = {
  buffering: boolean;
  /** Seconds that could actually be exported, measured from the oldest key frame. */
  availableSeconds: number;
  sampleCount: number;
  bytes: number;
  width: number;
  height: number;
  encodedFrames: number;
  droppedFrames: number;
  lastError: string | null;
};

export type TrackProbe = {
  /** False means the native WebRTC module could not be reached at all. */
  webrtcModuleAvailable: boolean;
  found: boolean;
  isVideoTrack: boolean;
  kind: string | null;
  id: string | null;
  enabled: boolean | null;
  state: string | null;
  nativeClass: string | null;
};

export type PreparedClip = {
  /** file:// URI for playback. */
  uri: string;
  /** Filesystem path, used when discarding. */
  path: string;
  durationSeconds: number;
  sampleCount: number;
  sizeBytes: number;
  requestedSeconds: number;
};

/** Identifies a track to the native side; both values come from react-native-webrtc. */
export type TrackHandle = {
  /** -1 for local tracks, otherwise the peer connection that received it. */
  peerConnectionId: number;
  trackId: string;
};

/** Spike verification only (M2); see the native module for why it exists. */
export type ClipInspection = {
  decodedFrame: boolean;
  framePath: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  rotation: number | null;
  frameCount: number | null;
};

type ReplayBufferNativeModule = {
  probeTrack(peerConnectionId: number, trackId: string): Promise<TrackProbe>;
  start(peerConnectionId: number, trackId: string): Promise<boolean>;
  stop(): Promise<boolean>;
  getStatus(): ReplayBufferStatus;
  prepareClip(seconds: number): Promise<PreparedClip>;
  inspectClip(path: string, atSeconds: number): Promise<ClipInspection>;
  discardClip(path: string): Promise<boolean>;
  clearAll(): Promise<number>;
};

const native = requireOptionalNativeModule<ReplayBufferNativeModule>('ReplayBuffer');

export const isReplayBufferAvailable = native !== null;

function requireNative(): ReplayBufferNativeModule {
  if (!native) {
    throw new Error('The replay buffer is not available on this platform. Android only until M8.');
  }
  return native;
}

export const IDLE_STATUS: ReplayBufferStatus = {
  buffering: false,
  availableSeconds: 0,
  sampleCount: 0,
  bytes: 0,
  width: 0,
  height: 0,
  encodedFrames: 0,
  droppedFrames: 0,
  lastError: null,
};

export function probeTrack(handle: TrackHandle): Promise<TrackProbe> {
  return requireNative().probeTrack(handle.peerConnectionId, handle.trackId);
}

export function startBuffering(handle: TrackHandle): Promise<boolean> {
  return requireNative().start(handle.peerConnectionId, handle.trackId);
}

export function stopBuffering(): Promise<boolean> {
  return requireNative().stop();
}

export function getStatus(): ReplayBufferStatus {
  return native ? native.getStatus() : IDLE_STATUS;
}

export function prepareClip(seconds: 15 | 30): Promise<PreparedClip> {
  return requireNative().prepareClip(seconds);
}

export function inspectClip(path: string, atSeconds = 0.5): Promise<ClipInspection> {
  return requireNative().inspectClip(path, atSeconds);
}

export function discardClip(path: string): Promise<boolean> {
  return requireNative().discardClip(path);
}

/** Buffer emptied, encoder released, every temporary clip deleted (FR-16). */
export function clearAll(): Promise<number> {
  return native ? native.clearAll() : Promise.resolve(0);
}
