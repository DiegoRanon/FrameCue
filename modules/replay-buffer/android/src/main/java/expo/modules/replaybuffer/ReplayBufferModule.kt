package expo.modules.replaybuffer

import android.util.Log
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * The coach-side rolling replay buffer (FR-07 to FR-09, FR-16).
 *
 * Buffers the newest seconds of an incoming video track in memory and, on
 * request, writes the trailing 15 or 30 seconds to a temporary MP4. Nothing is
 * uploaded and nothing outlives the session.
 *
 * Every call into WebRTC goes through one serial executor - see TrackResolver
 * for why.
 */
class ReplayBufferModule : Module() {

  private val executor = Executors.newSingleThreadExecutor()
  private val buffer = EncodedRingBuffer(
    capacityUs = TimeUnit.SECONDS.toMicros(BUFFER_CAPACITY_SECONDS),
    maxBytes = MAX_BUFFER_BYTES,
  )

  private var recorder: VideoBufferRecorder? = null
  private var resolver: TrackResolver? = null

  override fun definition() = ModuleDefinition {
    Name("ReplayBuffer")

    /**
     * Milestone 2 gate: can this module reach the native track behind a
     * JavaScript track id at all? Reported rather than thrown so the dev screen
     * can show exactly which half failed.
     */
    AsyncFunction("probeTrack") { peerConnectionId: Int, trackId: String ->
      runOnExecutor {
        val trackResolver = resolver()
        val module = trackResolver.webrtcModule()
        val track = if (module == null) null else trackResolver.find(peerConnectionId, trackId)
        mapOf(
          "webrtcModuleAvailable" to (module != null),
          "found" to (track != null),
          "isVideoTrack" to (track != null && track.kind() == "video"),
          "kind" to track?.kind(),
          "id" to track?.id(),
          "enabled" to track?.enabled(),
          "state" to track?.state()?.name,
          "nativeClass" to track?.javaClass?.name,
        )
      }
    }

    AsyncFunction("start") { peerConnectionId: Int, trackId: String ->
      runOnExecutor {
        stopInternal()
        val track = resolver().findVideoTrack(peerConnectionId, trackId)
          ?: throw TrackNotFoundException(peerConnectionId, trackId)
        buffer.clear()
        recorder = VideoBufferRecorder(buffer).also { it.attach(track) }
        Log.i(TAG, "Buffering track " + trackId + " on peer connection " + peerConnectionId)
        true
      }
    }

    AsyncFunction("stop") {
      runOnExecutor {
        stopInternal()
        true
      }
    }

    Function("getStatus") {
      val active = recorder
      mapOf(
        "buffering" to (active != null),
        "availableSeconds" to buffer.availableUs() / 1_000_000.0,
        "sampleCount" to buffer.sampleCount(),
        "bytes" to buffer.byteCount(),
        "width" to (active?.frameWidth ?: 0),
        "height" to (active?.frameHeight ?: 0),
        "encodedFrames" to (active?.encodedFrames ?: 0),
        "droppedFrames" to (active?.droppedFrames ?: 0),
        "lastError" to active?.lastError,
      )
    }

    /** Writes the trailing [seconds] to a temporary MP4 (FR-08, FR-09). */
    AsyncFunction("prepareClip") { seconds: Int ->
      runOnExecutor {
        val active = recorder ?: throw NotBufferingException()
        val format = active.outputFormat ?: throw NotReadyException()
        val snapshot = buffer.snapshot(TimeUnit.SECONDS.toMicros(seconds.toLong()))
          ?: throw NotReadyException()

        val destination = File(clipDirectory(), "replay-" + System.currentTimeMillis() + ".mp4")
        val result = ClipWriter.write(snapshot, format, active.rotationDegrees, destination)
        Log.i(TAG, "Prepared clip " + destination.name + " of " + result.durationSeconds + "s")
        mapOf(
          "uri" to android.net.Uri.fromFile(result.file).toString(),
          "path" to result.file.absolutePath,
          "durationSeconds" to result.durationSeconds,
          "sampleCount" to result.sampleCount,
          "sizeBytes" to result.sizeBytes,
          "requestedSeconds" to seconds,
        )
      }
    }

    /** FR-16: a discarded or replaced replay leaves nothing behind. */
    AsyncFunction("discardClip") { path: String ->
      runOnExecutor {
        deleteClipFile(path)
      }
    }

    /**
     * Full teardown: buffer emptied, encoder released, every clip deleted.
     * Called on leaving a session and on app start, so a restart cannot
     * recover a previous replay (AC-12).
     */
    AsyncFunction("clearAll") {
      runOnExecutor {
        stopInternal()
        buffer.clear()
        deleteAllClips()
      }
    }

    /**
     * AC-12: a restart must not be able to recover a previous replay. Clips
     * live in the cache directory, which the system does not clear on its own,
     * so the app wipes it as it starts.
     */
    OnCreate {
      runCatching { deleteAllClips() }
        .onFailure { error -> Log.w(TAG, "Could not clear old clips", error) }
    }

    OnDestroy {
      runCatching { stopInternal() }
      runCatching { deleteAllClips() }
      executor.shutdown()
    }
  }

  private fun resolver(): TrackResolver =
    resolver ?: TrackResolver(appContext).also { resolver = it }

  private fun stopInternal() {
    recorder?.release()
    recorder = null
    buffer.clear()
  }

  private fun clipDirectory(): File {
    val context = appContext.reactContext ?: throw NoContextException()
    return File(context.cacheDir, CLIP_DIRECTORY).apply { mkdirs() }
  }

  private fun deleteClipFile(path: String): Boolean {
    val file = File(path.removePrefix("file://"))
    val directory = clipDirectory()
    // Never delete outside our own cache directory, whatever we are handed.
    if (file.parentFile?.absolutePath != directory.absolutePath) {
      return false
    }
    return file.delete()
  }

  private fun deleteAllClips(): Int {
    val files = clipDirectory().listFiles() ?: return 0
    return files.count { it.delete() }
  }

  private fun <T> runOnExecutor(block: () -> T): T = executor.submit(block).get()

  private class TrackNotFoundException(peerConnectionId: Int, trackId: String) :
    CodedException(
      "No video track " + trackId + " on peer connection " + peerConnectionId +
        ". The call may have ended or the track may not be subscribed yet.",
    )

  private class NotBufferingException :
    CodedException("The replay buffer is not running. Call start() first.")

  private class NotReadyException :
    CodedException("Not enough buffered video yet to prepare a replay.")

  private class NoContextException :
    CodedException("No Android context available for the replay buffer.")

  companion object {
    private const val TAG = "FrameCueReplayBuffer"
    private const val CLIP_DIRECTORY = "framecue-replays"

    // Spec section 7.2: retain 30 to 35 seconds so a 30 s request always has a
    // key frame to start from.
    private const val BUFFER_CAPACITY_SECONDS = 35L

    // Hard ceiling regardless of bitrate (NFR-05). 35 s at 2.5 Mbps is about
    // 11 MB, so this leaves headroom without ever being unbounded.
    private const val MAX_BUFFER_BYTES = 24 * 1024 * 1024
  }
}
