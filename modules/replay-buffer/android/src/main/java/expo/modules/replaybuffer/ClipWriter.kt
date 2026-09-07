package expo.modules.replaybuffer

import android.media.MediaCodec
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

internal class ClipResult(
  val file: File,
  val durationSeconds: Double,
  val sampleCount: Int,
  val sizeBytes: Long,
)

/**
 * Muxes buffered samples into a temporary MP4.
 *
 * The file lives in the cache directory and is owned by the pending replay: it
 * is deleted on discard, replace, return to live, and session end (FR-16).
 * Nothing here writes to shared storage, a media collection, or anywhere the
 * system would index it.
 */
internal object ClipWriter {

  fun write(
    snapshot: RingBufferSnapshot,
    format: MediaFormat,
    rotationDegrees: Int,
    destination: File,
  ): ClipResult {
    val muxer = MediaMuxer(destination.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    try {
      val trackIndex = muxer.addTrack(format)
      // Whole-file hint rather than rotating pixels: rotating every frame would
      // cost more than the buffer itself, and players honour the hint.
      if (rotationDegrees != 0) {
        muxer.setOrientationHint(rotationDegrees)
      }
      muxer.start()

      val info = MediaCodec.BufferInfo()
      val baseUs = snapshot.samples.first().presentationTimeUs
      snapshot.samples.forEach { sample ->
        val flags = if (sample.isKeyFrame) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
        info.set(0, sample.data.size, sample.presentationTimeUs - baseUs, flags)
        muxer.writeSampleData(trackIndex, ByteBuffer.wrap(sample.data), info)
      }

      muxer.stop()
    } finally {
      runCatching { muxer.release() }
    }

    return ClipResult(
      file = destination,
      durationSeconds = snapshot.durationUs / 1_000_000.0,
      sampleCount = snapshot.samples.size,
      sizeBytes = destination.length(),
    )
  }
}
