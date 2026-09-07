package expo.modules.replaybuffer

import com.facebook.react.bridge.ReactApplicationContext
import com.oney.WebRTCModule.WebRTCModule
import expo.modules.kotlin.AppContext
import org.webrtc.MediaStreamTrack
import org.webrtc.VideoTrack

/**
 * Finds the native WebRTC track behind a JavaScript track id.
 *
 * react-native-webrtc keeps every track in WebRTCModule: local tracks under
 * peer connection id -1, remote tracks under the id of the peer connection
 * that received them. LiveKit is a layer above that module, so a LiveKit
 * RemoteVideoTrack's `mediaStreamTrack` carries both values and this resolver
 * gets us the org.webrtc.VideoTrack the ring buffer needs to observe.
 *
 * Thread note: WebRTCModule mutates its track maps on its own single-thread
 * executor, which is package-private and not reachable from here. We read them
 * from our own serial executor. The maps only change when a track is added or
 * removed, which does not happen while a call is established, so this read is
 * safe in practice - but it is the reason every call into WebRTCModule from
 * this module goes through one thread.
 */
internal class TrackResolver(private val appContext: AppContext) {
  fun webrtcModule(): WebRTCModule? {
    val reactContext = appContext.reactContext as? ReactApplicationContext ?: return null
    return reactContext.getNativeModule(WebRTCModule::class.java)
  }

  fun find(peerConnectionId: Int, trackId: String): MediaStreamTrack? =
    webrtcModule()?.getTrack(peerConnectionId, trackId)

  fun findVideoTrack(peerConnectionId: Int, trackId: String): VideoTrack? =
    find(peerConnectionId, trackId) as? VideoTrack
}
