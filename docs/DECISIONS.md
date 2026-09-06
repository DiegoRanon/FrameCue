# Technical decisions

Significant decisions only, newest last. Each entry records what was chosen, why, and what it costs.
Per `CLAUDE.md`, an approved decision is not changed without asking first.

---

## D-001 - Replay pipeline: coach-side ring buffer, clip pre-transferred during the pending window

**Date:** 2026-08-29 **Status:** Accepted **Milestones:** M2, M4

The coach client taps the incoming student video track into a bounded ring buffer holding the newest
30-35 seconds. On Prepare, it writes the requested interval to a temporary MP4 and pushes that file to the
student **in the background while the replay is pending**. On Show Replay, both devices play their own
local copy, kept in step by control messages over the data channel.

**Why:** Show Replay becomes effectively instant (NFR-01) because the transfer already completed during the
coach's waiting period, which spec section 3.1 establishes as the normal flow. Playing a local file on both
sides also makes pause, seek, restart, and 0.5x far more precise than driving a live track (NFR-02).

**Cost / consequences:** Requires a native encoder and ring buffer per platform (M2 Android, M8 iOS). A
prepared replay is briefly present as a file in the app cache directory, so cleanup (FR-16) must delete it
on discard, replace, return-to-live, session end, and app start.

---

## D-002 - Deviation from spec section 12: blob transfer instead of a presentation track

**Date:** 2026-08-29 **Status:** Accepted, deviates from `docs/MVP_SPEC.md` section 12

Spec section 12 recommends "a temporary video/presentation track so playback can begin without transferring
a full 30-second blob". FrameCue transfers the clip instead.

**Why:** That recommendation targets Show-time latency. Transferring during the pending window removes the
latency entirely, and avoids building a custom WebRTC video capturer that decodes a file into a live track
on both platforms - roughly double the native work, with worse control synchronization.

**Cost / consequences:** A 15 s clip at ~1.5 Mbps is roughly 2.8 MB, 30 s roughly 5.6 MB. If a coach shows a
replay within a second or two of preparing it, the transfer may still be in flight; M4 must handle that case
by showing transfer state rather than failing.

---

## D-003 - WebRTC via LiveKit Cloud

**Date:** 2026-08-29 **Status:** Accepted

`@livekit/react-native` (2.12.x) over `@livekit/react-native-webrtc` (144.x), against LiveKit Cloud.

**Why:** Hosted signaling, TURN, adaptive bitrate (NFR-06), data messages, and byte-stream file transfer
without building or operating any of it. Critically, it is a thin layer over a `react-native-webrtc` fork,
so the native `VideoTrack` needed by D-001 is still reachable from our own native module.

**Cost / consequences:** A vendor dependency, self-hostable later if needed. The fork uses its own package
namespace, so M2's first task is a reachability probe: get the underlying native video track handle for a
remote participant from Kotlin. If that fails, fall back to `react-native-webrtc` directly with LiveKit kept
for signaling only.

---

## D-004 - Backend on Supabase, built after the replay spike

**Date:** 2026-08-29 **Status:** Accepted **Milestone:** M6

Magic-link auth, Postgres for the four entities in spec section 7.4, row-level security, and an edge
function that exchanges an invitation token for a short-lived LiveKit token.

**Why:** Removes roughly a week of auth, email, and CRUD work. Sequenced after the spike so no backend is
built before the feature that decides the project is proven.

**Cost / consequences:** Storage buckets are never enabled on the project - that is the concrete enforcement
of NFR-09. M1 through M5 use a development token from `.env` instead.

---

## D-005 - Expo with prebuild and a custom dev client; native code in a local Expo module

**Date:** 2026-08-29 **Status:** Accepted **Milestone:** M0

Expo SDK 57 (React Native 0.86), `expo prebuild` generating `android/`, and the replay pipeline living in
`modules/replay-buffer` as a local Expo module.

**Why:** The lightest setup that still supports the required native work (spec section 12). `android/` and
`ios/` stay generated and git-ignored, so the only native source under version control is ours.

**Cost / consequences:** Expo Go cannot be used; every developer needs a dev-client build. LiveKit's SDK
(published 2026-07-23) postdates SDK 57's stable release (2026-06-30); an Android debug build links
`libjingle_peerconnection_so.so` successfully, so the stacks are compatible at the native level. M1 must
still treat a successful two-device call as the functional proof. Downgrading to SDK 56 is the fallback.

`react-native-reanimated` (4.5.1) and `react-native-worklets` (0.10.1) must stay pinned as direct
dependencies even though nothing imports them directly. They arrive transitively via `expo-router`, and
without the pins npm hoists a newer worklets than `expo-modules-core` compiles against, which fails the
C++ build with `no member named 'executeSync'`. Run `npx expo install --check` after touching dependencies.

---

## D-006 - Android first; iOS deferred to M8

**Date:** 2026-08-29 **Status:** Accepted

**Why:** The development machine is Windows with no Mac, so Android gives a fast local build loop while iOS
would cost a cloud build cycle per native change. Spec Gate 1 asks for cross-platform proof; this defers,
not cancels, that proof.

**Cost / consequences:** Gate 1 is only partly satisfied until M8. The native module's TypeScript interface
is defined platform-agnostically in M2 so the iOS implementation drops in behind it unchanged. The pilot
device matrix cannot be published until M8 completes.

---

## D-007 - JDK 17 from Android Studio's bundled runtime

**Date:** 2026-08-29 **Status:** Accepted **Milestone:** M0

`android/gradle.properties` pins `org.gradle.java.home` to the JBR shipped with Android Studio (17.0.6).

**Why:** The machine's default JDKs are 21 and 25; React Native's Gradle setup targets 17. Pinning avoids
installing another JVM and avoids depending on a `JAVA_HOME` that is currently unset.

**Cost / consequences:** The path is machine-specific. `android/` is git-ignored and regenerated by
`expo prebuild`, so this pin is re-applied by `scripts/android-jdk.mjs`, invoked from the prebuild scripts.

---

## D-008 - `npm run android` drives adb directly instead of `expo run:android`

**Date:** 2026-08-29 **Status:** Accepted **Milestone:** M0

[scripts/android-run.mjs](../scripts/android-run.mjs) builds, installs, and launches on a chosen online
device.

**Why:** adb probes localhost ports 5555-5585 looking for emulators and treats any listener as one. On this
development machine `NTKDaemon.exe` (Nahimic audio service) holds 5563, so adb permanently reports a
phantom `emulator-5562` in the offline state. Expo's runner calls `adb -s <id> emu avd name` for every
reported device inside a `Promise.all`, the phantom's console port refuses the connection, and the whole
run aborts before installing.

**Cost / consequences:** We no longer get Expo's device picker or its automatic Metro startup, so `npm start`
runs in its own terminal. `npm run android:expo` keeps the stock path available. The alternative fix -
stopping the Nahimic service so the phantom disappears - is a machine change outside the repo and is left
to the developer.

---

## D-009 - Local configuration lives in `framecue.local.json`, not `.env`

**Date:** 2026-08-29 **Status:** Accepted **Milestone:** M1

`app.config.ts` reads a git-ignored `framecue.local.json`; environment variables still take precedence when
set, which is what EAS and CI will use.

**Why:** Expo's dotenv loader (`@expo/env`) calls `node:util.parseEnv`, which exists only on Node 20.12+ /
21.7+. This development machine runs Node 21.0.0, where the mere presence of any `.env` file crashes
`expo start` before the config is read. Neither `expo` nor `@expo/cli` declares an `engines` field, so npm
gives no warning and the failure surfaces as an opaque `TypeError: parseEnv is not a function`.

**Cost / consequences:** One more file for a developer to know about, and it deviates from the usual Expo
convention. Upgrading to Node 22 LTS would make `.env` viable again, and is worth doing anyway - Node 21 is
past end of life - but the project no longer depends on it. The path is resolved against `__dirname` rather
than `process.cwd()`, because the dev server does not always evaluate the config from the project root.

---

## D-010 - Configuration is embedded at build time, so config changes require a rebuild

**Date:** 2026-08-29 **Status:** Observed constraint **Milestone:** M1

`Constants.expoConfig.extra` on device comes from `app.config` embedded in the APK during the Gradle build,
not from the manifest Metro serves. Editing `framecue.local.json` and restarting Metro changes nothing on
the device.

**Why it matters:** It silently looks like a code bug - the app reports "LiveKit is not configured" while
`npx expo config --type public` shows the correct values. After changing configuration, run `npm run
android`.

---

## D-011 - `@livekit/components-react` and `react-dom` are direct dependencies

**Date:** 2026-08-29 **Status:** Accepted **Milestone:** M1

**Why:** `@livekit/react-native` ships only three hooks of its own; `useTracks`, `useLocalParticipant`,
`useConnectionState`, and `useRoomContext` come from `@livekit/components-react`, which npm does not hoist.
Importing through another package's `node_modules` would be fragile, and two copies of that package would
give two React contexts, so `useRoomContext` would fail inside `LiveKitRoom`.

`react-dom` is pinned to 19.2.3 purely to satisfy that package's `react-dom >= 18` peer without npm pulling
19.2.8, which demands a newer React than Expo SDK 57 pins. It is a devDependency and nothing imports it, so
it never reaches the bundle.
