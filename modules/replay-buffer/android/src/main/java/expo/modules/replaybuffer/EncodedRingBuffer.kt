package expo.modules.replaybuffer

import android.media.MediaCodec

/** One encoded frame. Encoded, not raw: 30 s of raw 720p would be gigabytes. */
internal class EncodedSample(
  val data: ByteArray,
  val presentationTimeUs: Long,
  val isKeyFrame: Boolean,
)

internal class RingBufferSnapshot(
  val samples: List<EncodedSample>,
  val durationUs: Long,
)

/**
 * Bounded store of encoded frames, evicted whole GOPs at a time so the buffer
 * always begins at a key frame and can therefore always be exported.
 *
 * Two independent caps (NFR-05): wall-clock span, and total bytes as a hard
 * stop in case the encoder produces more than expected.
 */
internal class EncodedRingBuffer(
  private val capacityUs: Long,
  private val maxBytes: Int,
) {
  private val samples = ArrayDeque<EncodedSample>()
  private var bytes = 0

  @Synchronized
  fun add(sample: EncodedSample) {
    samples.addLast(sample)
    bytes += sample.data.size
    trim()
  }

  @Synchronized
  fun clear() {
    samples.clear()
    bytes = 0
  }

  @Synchronized
  fun sampleCount(): Int = samples.size

  @Synchronized
  fun byteCount(): Int = bytes

  /**
   * Seconds that could actually be exported: measured from the oldest key
   * frame, since a clip cannot start mid-GOP.
   */
  @Synchronized
  fun availableUs(): Long {
    val first = samples.firstOrNull { it.isKeyFrame } ?: return 0
    val last = samples.lastOrNull() ?: return 0
    return (last.presentationTimeUs - first.presentationTimeUs).coerceAtLeast(0)
  }

  /**
   * The trailing [requestedUs] of video, starting at the key frame closest to
   * the requested start. With a one-second key frame interval that keeps the
   * clip within about half a second of the request (AC-06, AC-07).
   */
  @Synchronized
  fun snapshot(requestedUs: Long): RingBufferSnapshot? {
    val last = samples.lastOrNull() ?: return null
    val target = last.presentationTimeUs - requestedUs

    var startIndex = -1
    var bestDistance = Long.MAX_VALUE
    samples.forEachIndexed { index, sample ->
      if (sample.isKeyFrame) {
        val distance = kotlin.math.abs(sample.presentationTimeUs - target)
        if (distance < bestDistance) {
          bestDistance = distance
          startIndex = index
        }
      }
    }
    if (startIndex < 0) {
      return null
    }

    val selected = samples.drop(startIndex).toList()
    if (selected.size < 2) {
      return null
    }
    val durationUs = selected.last().presentationTimeUs - selected.first().presentationTimeUs
    return RingBufferSnapshot(selected, durationUs)
  }

  private fun trim() {
    val newest = samples.lastOrNull() ?: return

    // Drop leading GOPs while the buffer is over either cap. Stopping at a key
    // frame is what keeps the remaining buffer exportable.
    while (samples.size > 1) {
      val oldest = samples.first()
      val overTime = newest.presentationTimeUs - oldest.presentationTimeUs > capacityUs
      val overBytes = bytes > maxBytes
      if (!overTime && !overBytes) {
        return
      }
      // Remove one whole GOP: the leading key frame plus following deltas.
      samples.removeFirst()
      bytes -= oldest.data.size
      while (samples.size > 1 && !samples.first().isKeyFrame) {
        val dropped = samples.removeFirst()
        bytes -= dropped.data.size
      }
    }
  }

  companion object {
    fun keyFrameFlagOf(info: MediaCodec.BufferInfo): Boolean =
      info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0
  }
}
