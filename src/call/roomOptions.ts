import { VideoPresets, type RoomOptions } from 'livekit-client';

/** Which camera to publish, chosen in the pre-call check. */
export type FacingMode = 'user' | 'environment';

/**
 * 720p at 30 fps is the pilot target (spec section 6.1). Adaptive stream and
 * dynacast let LiveKit step down resolution and bitrate when bandwidth
 * deteriorates instead of dropping the call (NFR-06).
 *
 * Simulcast layers matter for the replay work: the coach receives the highest
 * layer the link supports, and that received track is what M2 buffers.
 */
export function callRoomOptions(facingMode: FacingMode): RoomOptions {
  return {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
      facingMode,
    },
    publishDefaults: {
      videoEncoding: VideoPresets.h720.encoding,
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      simulcast: true,
      red: true,
      dtx: true,
    },
  };
}
