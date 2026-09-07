package expo.modules.replaybuffer

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import java.util.concurrent.atomic.AtomicInteger
import org.webrtc.VideoFrame
import org.webrtc.VideoSink
import org.webrtc.VideoTrack
import org.webrtc.YuvHelper

/**
 * Encodes an incoming WebRTC video track into a rolling buffer (FR-07).
 *
 * The sink callback runs on the WebRTC rendering thread, so nothing expensive
 * happens there: frames are retained and handed to a private encoder thread,
 * and dropped outright when that thread falls behind. Preparing a replay must
 * never disturb the live call (NFR-04), which starts with never blocking the
 * thread that renders it.
 */
internal class VideoBufferRecorder(
  private val buffer: EncodedRingBuffer,
  private val bitRate: Int = 2_500_000,
  private val frameRate: Int = 30,
) : VideoSink {

  private val thread = HandlerThread("framecue-replay-encoder").apply { start() }
  private val handler = Handler(thread.looper)
  private val queued = AtomicInteger(0)

  private var encoder: MediaCodec? = null
  private var encoderWidth = 0
  private var encoderHeight = 0
  private var firstFrameNs = -1L
  private var lastPtsUs = -1L

  @Volatile private var track: VideoTrack? = null

  @Volatile
  var outputFormat: MediaFormat? = null
    private set

  @Volatile
  var rotationDegrees = 0
    private set

  @Volatile
  var frameWidth = 0
    private set

  @Volatile
  var frameHeight = 0
    private set

  @Volatile
  var droppedFrames = 0
    private set

  @Volatile
  var encodedFrames = 0
    private set

  @Volatile
  var lastError: String? = null
    private set

  fun attach(videoTrack: VideoTrack) {
    track = videoTrack
    videoTrack.addSink(this)
  }

  fun detach() {
    track?.let { existing ->
      runCatching { existing.removeSink(this) }
        .onFailure { error -> Log.w(TAG, "removeSink failed", error) }
    }
    track = null
  }

  fun release() {
    detach()
    handler.post {
      releaseEncoder()
      buffer.clear()
    }
    thread.quitSafely()
  }

  override fun onFrame(frame: VideoFrame) {
    // A short queue is the whole back-pressure strategy: if the encoder cannot
    // keep up we lose buffered frames, never live ones.
    if (queued.get() >= MAX_QUEUED_FRAMES) {
      droppedFrames++
      return
    }
    frame.retain()
    queued.incrementAndGet()
    handler.post {
      try {
        encodeFrame(frame)
      } catch (error: Throwable) {
        lastError = error.message ?: error.javaClass.simpleName
        Log.e(TAG, "Encoding failed", error)
      } finally {
        frame.release()
        queued.decrementAndGet()
      }
    }
  }

  private fun encodeFrame(frame: VideoFrame) {
    val i420 = frame.buffer.toI420() ?: return
    try {
      val width = i420.width
      val height = i420.height
      if (width <= 0 || height <= 0) {
        return
      }

      // A resolution change means the encoded stream is no longer decodable as
      // one sequence, so the buffer restarts. Spec section 3.2: prepare stays
      // unavailable until a continuous window exists again.
      if (encoder != null && (width != encoderWidth || height != encoderHeight)) {
        Log.i(TAG, "Track resolution changed to " + width + "x" + height + "; restarting buffer")
        releaseEncoder()
        buffer.clear()
      }

      val codec = encoder ?: startEncoder(width, height) ?: return
      rotationDegrees = frame.rotation
      frameWidth = width
      frameHeight = height

      if (firstFrameNs < 0) {
        firstFrameNs = frame.timestampNs
      }
      var ptsUs = (frame.timestampNs - firstFrameNs) / 1000
      if (ptsUs <= lastPtsUs) {
        ptsUs = lastPtsUs + 1000
      }
      lastPtsUs = ptsUs

      val inputIndex = codec.dequeueInputBuffer(0)
      if (inputIndex < 0) {
        droppedFrames++
      } else {
        fillInputBuffer(codec, inputIndex, i420, width, height)
        codec.queueInputBuffer(inputIndex, 0, width * height * 3 / 2, ptsUs, 0)
      }
      drainEncoder(codec)
    } finally {
      i420.release()
    }
  }

  /**
   * libyuv does the layout conversion. Asking the codec for an Image gives the
   * real plane strides, which differ between devices; guessing them produces
   * green or sheared video.
   */
  private fun fillInputBuffer(
    codec: MediaCodec,
    index: Int,
    i420: VideoFrame.I420Buffer,
    width: Int,
    height: Int,
  ) {
    val image = codec.getInputImage(index) ?: throw IllegalStateException("No codec input image")
    val y = image.planes[0]
    val u = image.planes[1]
    val v = image.planes[2]

    if (u.pixelStride == 2) {
      // Semi-planar (NV12): chroma interleaved in the second plane.
      YuvHelper.I420ToNV12(
        i420.dataY, i420.strideY,
        i420.dataU, i420.strideU,
        i420.dataV, i420.strideV,
        y.buffer, y.rowStride,
        u.buffer, u.rowStride,
        width, height,
      )
    } else {
      YuvHelper.I420Copy(
        i420.dataY, i420.strideY,
        i420.dataU, i420.strideU,
        i420.dataV, i420.strideV,
        y.buffer, y.rowStride,
        u.buffer, u.rowStride,
        v.buffer, v.rowStride,
        width, height,
      )
    }
  }

  private fun startEncoder(width: Int, height: Int): MediaCodec? {
    val format = MediaFormat.createVideoFormat(MIME_TYPE, width, height).apply {
      setInteger(
        MediaFormat.KEY_COLOR_FORMAT,
        MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible,
      )
      setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
      setInteger(MediaFormat.KEY_FRAME_RATE, frameRate)
      // One second between key frames: a clip can only start on a key frame,
      // so this bounds how far a 15 s or 30 s request can miss (AC-06, AC-07).
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }

    return try {
      MediaCodec.createEncoderByType(MIME_TYPE).also { codec ->
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        codec.start()
        encoder = codec
        encoderWidth = width
        encoderHeight = height
        firstFrameNs = -1L
        lastPtsUs = -1L
        outputFormat = null
        Log.i(TAG, "Encoder started at " + width + "x" + height)
      }
    } catch (error: Exception) {
      lastError = "Encoder start failed: " + error.message
      Log.e(TAG, "Encoder start failed", error)
      null
    }
  }

  private fun drainEncoder(codec: MediaCodec) {
    val info = MediaCodec.BufferInfo()
    while (true) {
      val index = codec.dequeueOutputBuffer(info, 0)
      if (index == MediaCodec.INFO_TRY_AGAIN_LATER) {
        return
      }
      if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
        outputFormat = codec.outputFormat
        continue
      }
      if (index < 0) {
        return
      }

      val output = codec.getOutputBuffer(index)
      val isCodecConfig = info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
      if (output != null && info.size > 0 && !isCodecConfig) {
        val data = ByteArray(info.size)
        output.position(info.offset)
        output.limit(info.offset + info.size)
        output.get(data)
        buffer.add(
          EncodedSample(
            data = data,
            presentationTimeUs = info.presentationTimeUs,
            isKeyFrame = EncodedRingBuffer.keyFrameFlagOf(info),
          ),
        )
        encodedFrames++
      }
      codec.releaseOutputBuffer(index, false)
    }
  }

  private fun releaseEncoder() {
    encoder?.let { codec ->
      runCatching { codec.stop() }
      runCatching { codec.release() }
    }
    encoder = null
    encoderWidth = 0
    encoderHeight = 0
    firstFrameNs = -1L
    lastPtsUs = -1L
    outputFormat = null
  }

  companion object {
    private const val TAG = "FrameCueReplayBuffer"
    private const val MIME_TYPE = "video/avc"
    private const val MAX_QUEUED_FRAMES = 3
  }
}
