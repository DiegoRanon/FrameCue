# FrameCue — iterative build plan

## Context

`FrameCue` is an empty git repository (no commits) holding only `CLAUDE.md`, `docs/MVP_SPEC.md`, an empty
`docs/ARCHITECTURE.md`, and an empty `README.md`. There is no application code, no `package.json`, and no
toolchain configuration yet.

The MVP spec describes a React Native 1-to-1 coaching app whose single differentiating feature is a
**temporary replay**: the coach prepares the student's previous 15 or 30 seconds without interrupting the
live call, then chooses when to show it on both screens while microphones stay live. Nothing is persisted.

`CLAUDE.md` requires one approved milestone at a time, so this plan does **not** implement the MVP. It
establishes the sequence of milestones, fixes the architecture decisions that unblock milestone 1, and
front-loads the one unknown that can kill the project — whether a 30-second ring buffer can be taken from
an incoming WebRTC track on a phone. Spec §7.3 and §11 both demand that spike before any polished UI, and
this plan follows that order.

The intended outcome of this document: an agreed milestone ladder where each rung is independently
verifiable on real devices, and the go/no-go evidence for Gate 1 arrives in milestone 2 rather than week 4.

## Decisions taken (to be recorded in `docs/DECISIONS.md` during M0)

| Decision | Choice | Rationale |
|---|---|---|
| Replay pipeline | Coach-side ring buffer → MP4 on Prepare → **background pre-transfer to student during the pending window** → both devices play their own local copy, synced by control messages | Show Replay becomes instant (NFR-01) because the transfer already happened while the coach waited. Avoids building a custom WebRTC video capturer that feeds a decoded file into a live track on two platforms. |
| Deviation from spec §12 | Spec prefers a *temporary presentation track* over transferring a blob. We transfer the blob, but during the pending window rather than at Show time | The §12 rationale is "so playback can begin without transferring a full 30-second blob" — i.e. Show-time latency. The pending window removes that concern entirely, and local-file playback on both sides makes pause/seek/0.5x sync far more precise (NFR-02). **Flagged for explicit approval; record in `docs/DECISIONS.md`.** |
| WebRTC | LiveKit Cloud + `@livekit/react-native` | Wraps `react-native-webrtc`, so raw native track handles remain reachable for the buffer tap. Hosted signaling, TURN, adaptive bitrate (NFR-06), data messages, and byte-stream file transfer come free. |
| Backend | Supabase (magic-link auth, Postgres, RLS, edge functions). **Storage buckets never enabled** (NFR-09) | Removes ~1 week of auth/CRUD/email work. Built in M6, not during the spike. |
| RN setup | Expo with `prebuild` + custom dev client, native code in a **local Expo module** | Lightest setup that still supports native modules (spec §12). Config plugins handle the LiveKit/WebRTC native wiring; `npx expo prebuild --clean` regenerates `android/` from source. |
| Platform order | **Android first**; iOS native pipeline deferred to M8 | Windows host, no Mac. Local Gradle loop keeps spike iteration fast. The native module's TS interface is defined platform-agnostically in M2 so the iOS implementation drops in behind it. |
| Replay audio | Muted; live mics are the channel | Spec §12. |

## Milestone ladder

Each milestone is a separate approved task with its own completion report. Do not start the next one
without approval.

### M0 — Scaffold and guardrails
Small, mechanical, unblocks everything.

- `npx create-expo-app` (TypeScript), then `expo prebuild` for Android only.
- Strict TypeScript, ESLint + Prettier, Jest + `@testing-library/react-native`.
- `npm run verify` = `typecheck && lint && test` — the command `CLAUDE.md`'s "run checks before completing"
  rule refers to from here on.
- `.env` handling via `expo-constants` / `app.config.ts`; `.env` git-ignored, `.env.example` committed.
- Seed `docs/DECISIONS.md` with the table above and fill `docs/ARCHITECTURE.md` (currently empty).
- **JDK note:** the machine has Java 25; React Native Gradle needs **JDK 17**. Install Temurin 17 and pin
  `org.gradle.java.home` in `android/gradle.properties`, or set `JAVA_HOME` for the build. Verify with a
  release-mode `assembleDebug` before declaring M0 done.

Proposed layout:

```
app/                      screens (coach live, student live, replay, dev)
src/call/                 LiveKit room connection + track hooks
src/replay/               pending-replay state machine + native module bridge
src/control/              data-channel message schema (zod) + send/receive
modules/replay-buffer/    local Expo module: index.ts, android/ (Kotlin), ios/ (M8)
docs/                     MVP_SPEC.md, ARCHITECTURE.md, DECISIONS.md
```

Exit: `npm run verify` green; dev client installs and launches a placeholder screen on an Android device.

### M1 — Two-device live call, no backend
- Hardcoded LiveKit room + dev tokens from `.env` (Supabase issues these in M6).
- Camera/mic permissions, publish local tracks, render remote track, mute / camera-off / leave.
- Coach layout: large student video preserving aspect ratio, small coach tile positioned so it cannot
  cover the student's lower body (§4.1); visible `LIVE` badge; plain-language connection state (FR-18).
- 720p/30fps target with adaptive downscale left to LiveKit (NFR-06).

Exit: two Android devices see and hear each other; AC-03.

### M2 — SPIKE: Android ring buffer from the incoming track (Gate 1)
The riskiest work. Order matters — the first step is a few hours and can invalidate the stack choice.

1. **Reachability probe first.** Obtain the underlying `org.webrtc.VideoTrack` for the remote participant's
   video from the LiveKit Android SDK inside our Kotlin module. If the SDK does not expose it, fall back to
   `react-native-webrtc` directly with LiveKit kept only for signaling — decide before writing the encoder.
2. `modules/replay-buffer` Kotlin implementation: attach a `VideoSink` to that track → `MediaCodec` H.264
   encoder → bounded ring of **encoded** samples (not raw frames) capped at 30–35 s.
   - Memory: encoded 720p ≈ 1.5 Mbps → ~5.6 MB for 30 s. Raw frames would be gigabytes; this is the whole
     reason to encode on ingest (NFR-05).
   - Request periodic keyframes (~2 s) so a 15 s or 30 s cut can start at an IDR.
   - Track continuity so `canPrepare15` / `canPrepare30` flip false on interruption (AC-04, AC-05, §3.2).
3. `prepare(seconds)` → `MediaMuxer` writes the trailing interval to an MP4 in the cache dir, returns a
   path + actual duration. Tolerance ±1 s (AC-06, AC-07).
4. `clear()` / lifecycle teardown releases codec, muxer, sink, and deletes files (FR-16).
5. TS surface (`modules/replay-buffer/index.ts`), platform-agnostic, iOS-ready:
   `start(trackId)`, `stop()`, `getAvailableSeconds()`, `prepare(15|30)`, `discard(clipId)`, `clear()`.
6. Dev-only screen: Prepare button, resulting file path, and local playback to eyeball the result.

Exit / **Gate 1 evidence**: pressing Prepare during a live call produces a correct MP4 of the preceding
interval; the call is visibly and audibly uninterrupted; memory stays flat across 10+ prepares. If this
fails, stop and reassess rather than adding server recording (spec §10).

### M3 — Pending replay state machine and coach-only UI
- One pending replay at a time; Replace requires confirmation; Discard clears (§5.1, §3.2).
- Coach-only `Replay Ready` card with duration, `Show Replay`, `Replace`, `Discard` (§4).
- Disabled/countdown states before 15 s and between 15–30 s.
- Coach-local playback via `react-native-video`: play, pause, seek, restart, 0.5x/1x (FR-11).
- Student sees nothing change (FR-10).
- Unit tests on the state machine — this is the part worth testing in Jest; the native pipeline is verified
  on-device.

Exit: AC-04 through AC-07 on the coach device.

### M4 — Clip transfer and synchronized shared review
- Push the MP4 to the student over LiveKit byte streams **when the replay is prepared**, not when shown;
  surface transfer state internally but do not gate `Replay Ready` on it unless it fails.
- Control-message protocol over the data channel (`src/control`, zod-validated): `show`, `play`, `pause`,
  `seek`, `restart`, `rate`, `returnLive`, each carrying a coach clock timestamp so the student can correct
  drift to ≤500 ms (NFR-02). Coach is authoritative.
- Student review UI: replay fills the view, mode label `REVIEWING LAST 15/30 SECONDS`, an indicator that the
  coach controls playback, no student controls (§3.1.7).
- Replay audio muted; mic tracks untouched (FR-12).
- `Return to Live` tears down review on both sides in <1 s without reconnecting (NFR-03, FR-13).

Exit: AC-08, AC-09, AC-10.

### M5 — Cleanup, soak, degraded states
- Destroy chunks, MP4s, and pending replay on end / leave / background / restart / fatal disconnect (FR-16).
- 10+ prepare→show cycles with no material memory growth; thermal observation (AC-11, NFR-05).
- Force-close and reopen proves nothing is recoverable (AC-12).
- Reconnect states; a replay failure must never end the live call (NFR-04, AC-14).

Exit: AC-11, AC-12, AC-14.

### M6 — Supabase session foundation
- Magic-link coach auth (FR-01); tables `coaches`, `sessions`, `invitations`, `session_events` per §7.4;
  RLS so a coach reaches only their own sessions. **No storage bucket.**
- Edge function: validate invitation token → mint short-lived LiveKit token, replacing M1's `.env` tokens.
- Expiring deep-link invitation opening the installed app (FR-02, FR-03).
- Coach dashboard, Create Session (30/45/60 min), student join screen with display name and the §8.2
  consent text acknowledged by both users (FR-04), pre-call device check (FR-05), session-ended screen.

Exit: AC-01, AC-02.

### M7 — Telemetry, privacy audit, accessibility, layouts
- The §9.2 event list only; assert no media bytes, frames, filenames, or invitation tokens in logs
  (AC-13, NFR-10).
- Accessible labels, contrast, large touch targets (NFR-11); portrait and landscape (NFR-12).

### M8 — iOS behind the same interface (deferred until devices exist)
`RTCVideoRenderer` sink → `VTCompressionSession` → same ring buffer semantics → `AVAssetWriter`, implemented
behind the M2 TypeScript interface. Then EAS cloud builds and cross-platform Gate 1 re-validation.

## Verification

Per milestone, before reporting completion:

```
npm run verify        # tsc --noEmit && eslint && jest
```

Plus the on-device checks, which are the real proof for everything from M1 onward:

- M1: two Android devices in one room, audio and video both directions, mute/camera/leave.
- M2: live call running, press Prepare 15s and Prepare 30s, `adb pull` the MP4 and confirm content and
  duration (±1 s); watch memory in Android Studio Profiler across 10 prepares.
- M3: prepare while the student keeps moving; confirm the student's screen never changes.
- M4: stopwatch Show Replay latency (≤2 s p95) and Return to Live (≤1 s); compare coach and student
  playback positions during pause/seek/rate changes.
- M5: force-close mid-session, reopen the invitation, confirm the replay is gone.

## Open items to resolve at their milestone

- LiveKit remote-track reachability from Kotlin (M2 step 1) — the one finding that could change the stack.
- Whether 0.5x replay of 720p/30fps is genuinely useful for fast boxing movement (spec §10 risk) — judge on
  real footage at M3, not by assumption.
- Clip bitrate/resolution for transfer size vs. clarity — tune at M4 against the 2 s target.
