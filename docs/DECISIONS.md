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

---

## D-012 - Replay quality follows the subscribed simulcast layer

**Date:** 2026-09-06 **Status:** Resolved by D-021 **Milestone:** M2

The buffer encodes whatever the coach's client actually receives, which spec section 10 defines as the
authoritative source. With `adaptiveStream` and simulcast enabled, LiveKit moves the coach between the
student's 180p, 360p, and 720p layers depending on view size and bandwidth. During the M2 session the same
call produced buffers at 180x320, 360x640, and 720x1280 within a few minutes.

**Consequences:** A replay prepared during a downgrade is a 360p replay, which is weak for judging technique

- the product's whole purpose. A resolution change also restarts the buffer, because the encoded stream is
  no longer one decodable sequence, so `Prepare` becomes unavailable until enough new history accumulates
  (spec section 3.2 behaviour, but triggered by bandwidth rather than a real interruption).

**Options for M5:** pin the coach's subscription to the highest layer while the call is healthy
(`setVideoQuality(HIGH)` on the student publication), accept adaptive quality, or pin only while a replay is
pending. Pinning trades live-call resilience (NFR-06) for replay quality. **Resolved in M5 - see D-021.**

Note for the record that the third option, pinning only while a replay is pending, cannot work: the clip is
cut from history the buffer already holds, so by the time a replay is pending the frames have been encoded
at whatever layer was arriving at the time. Quality has to be decided continuously or not at all.

---

## D-013 - Spike instrumentation is temporary and goes away with M3

**Date:** 2026-09-06 **Status:** Accepted **Milestone:** M2

`ReplayBufferPanel`, the `inspectClip` native function behind its Verify button, and the `dev-replay` screen
exist to prove the pipeline, not to ship. M3 replaces the panel with the Replay Ready card (Show Replay,
Replace, Discard) and `inspectClip` should go with it - spec section 4.2 rules thumbnails out of the
interface, and this function only ever wrote a JPEG so the exported video could be checked by eye.

---

## D-014 - expo-video for replay playback, not react-native-video

**Date:** 2026-09-09 **Status:** Accepted, deviates from the approved plan **Milestone:** M3

The plan named `react-native-video`; M3 uses `expo-video` instead, with the change approved before any code
was written.

**Why:** `expo-video@57.0.3` ships as part of Expo SDK 57, so its compatibility with React Native 0.86 is
guaranteed by the same versioning that governs every other Expo package here. `react-native-video`'s stable
6.19.2 predates RN 0.86 and declares a wildcard peer range, so npm would not have warned about a mismatch -
the exact trap that produced the `worklets` C++ failure in M0. Its 7.x line is still in beta.

**Cost / consequences:** Playback is driven by mutating player properties, which the React Compiler lint
forbids inside components. That pushed the mutations into `src/replay/playerCommands.ts` as a `ReplayCommand`
union - a better shape anyway, because M4 has to send exactly that vocabulary over the data channel, and now
the wire protocol and the local controls cannot drift apart.

One lifecycle trap cost real time and is worth remembering: `useVideoPlayer(source)` creates a _new_ player
whenever the source changes and releases the old one. Holding a player across clip changes left commands
silently doing nothing against a released instance. The app now keeps one player for the session and calls
`replaceAsync` when a replay is shown, playing only once that promise resolves - commands issued before the
source is ready are dropped.

---

## D-015 - Return to Live clears the pending replay

**Date:** 2026-09-09 **Status:** Accepted, interpretation **Milestone:** M3

After the coach returns to live, the replay is gone: the file is deleted and the card disappears. Showing it
again means preparing a new one.

**Why:** The section 10 risk table says the pending replay is cleared "after review, discard, replacement, or
session end". Keeping a used replay around would also mean two ideas of "pending" - one shown, one not -
against a spec that allows exactly one (section 5.1).

**Cost / consequences:** A coach who wants a second look at the same moment must prepare it again, which the
rolling buffer still allows because it keeps running throughout review (section 3.1.8). If pilot coaches ask
for a re-show, this is the decision to revisit - FR-14 only requires that replay can be _used_ repeatedly,
which it can.

---

## D-016 - The screen is kept awake for the whole call

**Date:** 2026-09-09 **Status:** Accepted **Milestone:** M3

`useKeepAwake()` in `CallScreen`, so it covers both roles and is released when the screen unmounts.

**Why:** A student on a tripod never touches the phone, so it slept after about 30 seconds and took the video
feed with it - which defeats FR-06 for the participant the whole product is pointed at. The coach was
unaffected only because they keep tapping.

**Cost / consequences:** Battery during a session, which is the right trade for a lesson-length call and
matches what every video-call app does.

---

## D-017 - `expo-file-system` for reading and writing clip bytes

**Date:** 2026-09-09 **Status:** Accepted, approved before implementation **Milestone:** M4

M4 has to read the prepared MP4 into JavaScript to push it over a LiveKit byte stream, and write the
received bytes back to a file on the student's device. Nothing in the project did file I/O. The alternative
considered was extending `modules/replay-buffer` with `readClipBytes` / `openIncomingClip` in Kotlin.

**Why:** `expo-file-system@~57.0.6` is the version pinned by Expo SDK 57, so its compatibility with React
Native 0.86 is guaranteed by the same versioning that governs every other Expo package here - the same
reasoning as D-014. Its `FileHandle` reads and writes at an offset, so a 6 MB clip never has to exist in
JavaScript memory in one piece. It works on both platforms, so M8's iOS work inherits it rather than
needing a second native implementation.

**Cost / consequences:** One more native dependency, so a dev-client rebuild is required. Clip files are now
touched from two places - the native module owns the coach's prepared clips, `src/replay/clipTransfer.ts`
owns the student's received copies - so FR-16 cleanup has to be right in both.

---

## D-018 - Control messages are reliable data packets; the clip goes over a byte stream

**Date:** 2026-09-09 **Status:** Accepted **Milestone:** M4

Two LiveKit topics. `framecue.replay.control` carries zod-validated JSON control messages as reliable data
packets. `framecue.replay.clip` carries the MP4 as a byte stream.

**Why:** A control message is a few hundred bytes and arrives in one round trip; a data stream would add a
header-chunks-trailer sequence to every Pause. Keeping the clip on its own topic means a 6 MB transfer
cannot delay a command the coach just issued. Both are validated on arrival and a message that fails
validation is dropped rather than throwing, because a control message is the one place a peer hands this
app arbitrary bytes and a replay failure must never end the call (NFR-04).

Messages are broadcast rather than addressed to an identity: a session has exactly one coach and one
student (spec section 5.1), so "everyone else" is the student, and not depending on a resolved participant
identity removes a way for Show Replay to silently go nowhere. The clip transfer _is_ addressed, because it
should not start before there is someone to receive it.

**Cost / consequences:** The protocol is JSON, which is larger than a binary encoding and irrelevant at this
message rate. A group session would need addressing before anything else.

---

## D-019 - The coach broadcasts a 1 Hz playback heartbeat, not just commands

**Date:** 2026-09-09 **Status:** Accepted, extends the approved plan **Milestone:** M4

The plan listed `show`, `play`, `pause`, `seek`, `restart`, `rate`, `returnLive`. Those all exist and carry
the coach's clock timestamp as specified. Added to them is `sync`: the same payload, sent once a second
while a replay is on screen, and again whenever the coach's player reports that it started, stopped, or
changed rate.

**Why:** Commands alone make the student's position correct at the instant each one arrives and never again.
Two independently decoding players drift - different buffering, different frame pacing, and 0.5x playback
doubles the wall-clock time over which any drift accumulates. NFR-02 asks for positions within ~500 ms, so
the follower is told the truth every second and corrects only when it is more than 300 ms out. That
tolerance exists because below it, seeking corrects less than the visible stutter it causes.

**Cost / consequences:** One extra message per second on a channel that is already carrying live media, and
no additional protocol surface - `sync` is the same shape as every other clip message.

Every message carries the coach's authoritative playback state rather than a bare verb, which makes the
protocol self-healing: a follower that missed a message is corrected by the next one instead of staying
wrong. Note what the coach's timestamp is _not_ used for. Elapsed time is measured from the follower's own
arrival time, because the two devices' clocks are unrelated and subtracting one from the other would bake in
an arbitrary offset. The timestamp's job is to discard a message that arrives after a newer one. This treats
one-way latency as zero, which on a reliable data channel is tens of milliseconds - an order of magnitude
inside the budget, and the only term measurable without a clock-sync handshake the MVP does not need.

---

## D-020 - Return to Live is an event, not a state to synchronize

**Date:** 2026-09-09 **Status:** Accepted **Milestone:** M4

On the student's device, leaving review pauses the player, unloads the source, and deletes the received clip
inside the control-message handler rather than in an effect keyed on "am I reviewing".

**Why:** NFR-03 gives it one second, and an effect adds a render cycle before any of it starts. It is also
what the React Compiler lint asks for - calling `setState` synchronously inside an effect body is an error
in this project - and the rule is right here: this is a reaction to something that happened, not
synchronization with an external system.

The same teardown runs when the remote participant disconnects. A coach who leaves mid-replay never sends
Return to Live, and the student must not be left holding a frozen clip with the call gone.

**Cost / consequences:** Two callers of the teardown instead of one declarative rule, which is why it lives
in a single `endReview` callback rather than being written twice.

---

## D-021 - Pin the coach to the highest simulcast layer while the connection is healthy

**Date:** 2026-09-09 **Status:** Accepted, resolves D-012 **Milestone:** M5

`setVideoQuality(HIGH)` on the student's camera publication whenever the connection status shown on screen
is healthy, released to `LOW` the moment it is not, and restored when it recovers.

**Why:** The replay is cut from whatever the coach actually receives, so an adaptive downgrade produces a
360p replay of the movement the product exists to judge. Pinning also stops the buffer restarting every time
the layer changes, which was making `Prepare` unavailable mid-lesson for reasons the coach could not see -
a section 3.2 degraded state triggered by bandwidth rather than a real interruption.

Releasing the pin on anything but a healthy connection is what keeps NFR-06 intact. Live video the lesson
depends on outranks replay sharpness, so the client can still step down rather than freeze.

The decision is driven by the same `ConnectionStatus` the badge renders, via `useConnectionStatus`, so the
layer the coach asks for and the state the coach is shown cannot disagree.

**Cost / consequences:** On a link that is degrading but not yet reported as poor, the coach holds a high
layer slightly longer than pure adaptation would. `adaptiveStream` still governs subscription based on what
is rendered, which is why D-023 matters.

---

## D-022 - Backgrounding clears the buffer but keeps a prepared replay

**Date:** 2026-09-09 **Status:** Accepted, narrows the approved plan **Milestone:** M5

The plan said to destroy chunks, MP4s and the pending replay on background. On backgrounding, FrameCue stops
the encoder and empties the ring buffer, but keeps an already-prepared replay.

**Why:** The two are not the same kind of thing. The ring buffer is live memory holding the student's video,
and Android stops delivering frames in the background anyway - a buffer that survived would have an
invisible hole in it, and `canPrepare` would be lying. The prepared replay is a file the coach deliberately
made and is waiting to show; losing it because they glanced at a notification throws away the moment they
were waiting for, and the file is deleted by every other FR-16 trigger regardless.

**Cost / consequences:** A prepared replay can outlive a brief backgrounding, so a clip file exists in the
cache while the app is not in the foreground. It is still deleted on discard, replace, return-to-live,
leave, fatal disconnect, and app start, and `startupCleanup` wipes it after a force-close (AC-12). On return
the Prepare countdown starts again from empty, which is honest: the window really was interrupted.

---

## D-023 - The live stage is covered during review, never unmounted

**Date:** 2026-09-09 **Status:** Accepted **Milestone:** M5

`LiveCallLayout` renders the live `VideoStage` at all times and overlays replay review on top of it, rather
than swapping one for the other.

**Why:** `adaptiveStream` decides what to subscribe to from what is actually being rendered. Unmounting the
live stage during review pauses the incoming track, which stalls the coach's rolling buffer exactly when
section 3.1.8 says it must keep running - so the first replay of a session would poison the next one. It
also makes Return to Live wait for a re-subscribe instead of being instant (NFR-03).

**Cost / consequences:** The live video keeps decoding underneath a replay that completely covers it, which
costs some GPU and battery during review. The covered stage is removed from the accessibility tree so a
screen reader does not announce two stages.

---

## D-024 - Hosted Supabase for devices, local stack for RLS tests only

**Date:** 2026-09-12 **Status:** Accepted **Milestone:** M6

Phones talk to a hosted Supabase project. The local Docker stack (`npm run db:start`) exists for
`npm run db:test`, which runs the pgTAP suite in `supabase/tests/database`, and for serving the edge
functions during development.

**Why:** A phone cannot reach `127.0.0.1`, and sign-in emails from the local stack point at the local API, so
device testing against it means LAN addresses and rewritten URLs. The hosted project provides TLS (NFR-07),
real email, and reachable functions. RLS is the part of M6 most worth proving automatically, and pgTAP needs
a real Postgres.

**Cost / consequences:** Two environments to keep in step: migrations reach the hosted project with
`supabase db push`, auth settings and the email template with `supabase config push`, and secrets with
`supabase secrets set`. `npm run verify` stays Docker-free; `npm run db:test` is a separate step.

---

## D-025 - Invitation tokens are derived, and only their hash is stored

**Date:** 2026-09-12 **Status:** Accepted **Milestone:** M6

A token is `base64url(HMAC-SHA256(INVITE_TOKEN_SECRET, invitation id))`, and `invitations.token_hash` holds its
SHA-256. The `invitation` function finds an invitation by hashing the token it was given.

**Why:** Spec section 7.4 asks for `token_hash`, and NFR-10 keeps tokens out of anything that could be logged
or dumped. But the dashboard must let a coach copy the link again (section 4), which a stored hash alone
cannot do. Deriving the token lets the server rebuild the same link on demand while the database never holds
it, so neither a table dump nor a backup can open a lesson.

**Cost / consequences:** The secret is load-bearing: changing `INVITE_TOKEN_SECRET` invalidates every link
already sent. Revoking one invitation without touching the others means replacing its row, which M6 does not
need.

---

## D-026 - LiveKit credentials come from two edge functions; the app holds no LiveKit configuration

**Date:** 2026-09-12 **Status:** Accepted, replaces the M1 development tokens **Milestone:** M6

`coach-sessions` (signed-in coach: create, inviteLink, join, end) and `invitation` (no account: preview,
join). Both mint a LiveKit token with a 10-minute TTL; grants limited to join, publish, subscribe, and data; a
fixed identity, `coach-<user id>` or `student-<invitation id>`; and one room per session,
`framecue-<session id>`. The LiveKit URL arrives with the token.

The request and response schemas (`supabase/functions/_shared/contract.ts`) and the session rules
(`policy.ts`) are imported by the functions and by the app, through the `@shared/*` alias.

**Why:** Tokens must be short-lived and issued only to invited participants (NFR-08), which rules out
anything configured on the device. Fixed identities enforce one student per session without extra code:
LiveKit evicts the older connection, and `describeDisconnect` already explains that to the evicted device.
No `roomAdmin` or `roomRecord` grant means no participant can start egress (NFR-09). Two functions rather
than one per action keep the auth model obvious: everything in `coach-sessions` needs a coach, nothing in
`invitation` does.

`verify_jwt` is off for both. The student has no JWT, and the gateway check does not accept the newer
publishable keys. `coach-sessions` verifies the coach's access token against Supabase Auth itself, and every
session read goes through a client acting as the coach, so RLS still decides.

**Cost / consequences:** The shared files may import nothing but `zod` and each other, with `.ts` extensions
on relative imports because Deno requires them; the root `tsconfig.json` sets `allowImportingTsExtensions`
and excludes the Deno-only files. Deno code is not type-checked by `npm run verify` - there is no Deno
toolchain on this machine - so the functions are proven by running them against the local stack instead.

---

## D-027 - End Session deletes the LiveKit room

**Date:** 2026-09-12 **Status:** Accepted **Milestone:** M6

The coach's Leave button becomes End, behind a confirmation. `coach-sessions end` marks the session ended,
expires its invitation, and deletes the LiveKit room, which disconnects both devices with `ROOM_DELETED`.
`describeDisconnect` reports that as `ended`, and both devices show Session ended (FR-17).

**Why:** A control message would depend on the student's app receiving and obeying it. Deleting the room is
authoritative, and the status change underneath means neither side can get new credentials to come back. The
status is written first, so a LiveKit outage cannot leave a session that looks ended but can still be joined.

**Cost / consequences:** Leaving without ending is the system back gesture; the session then stays open on
the dashboard. If LiveKit is unreachable when ending, the function still succeeds with `roomClosed: false`:
the coach's device leaves, and the student stays in an empty room until they leave.

---

## D-028 - Invitation and sign-in links are https App Links on a static invite host

**Date:** 2026-09-12 **Status:** Accepted **Milestone:** M6

`https://<invite host>/join/<token>` and `https://<invite host>/auth/callback`. The host serves `web/invite`:
`.well-known/assetlinks.json` for Android verification, and a static fallback page for a link opened without
the app. The app declares an `autoVerify` intent filter for both paths, and Expo Router routes on the path.

**Why:** WhatsApp, Gmail, and Google Messages only make http(s) links tappable, so a `framecue://` link would
reach most students as plain text (AC-02). The fallback page cannot come from a Supabase edge function,
because HTML responses on the functions domain are served as plain text, so the host is a separate static
site.

**Cost / consequences:** A domain the project controls, and a certificate fingerprint per signing key;
`assetlinks.json` holds the React Native debug key until release signing exists. The token is in the path,
so the static host's access logs and messenger link-preview crawlers can see it. The fallback page loads no
scripts or third-party resources, and a token only admits a student to one lesson's join screen. Moving the
token into the URL fragment would hide it from servers and is the first thing to revisit. iOS Universal
Links are M8.

---

## D-029 - The sign-in email carries a magic link and a one-time code

**Date:** 2026-09-12 **Status:** Accepted, extends the approved plan (approved 2026-09-12) **Milestone:** M6

`supabase/templates/sign_in.html` serves as both the magic-link and the confirmation template, and contains
the link and `{{ .Token }}`. The app signs in with PKCE (`exchangeCodeForSession`) when the link is tapped,
or with `verifyOtp` when the code is typed.

**Why:** PKCE ties a link to the phone that requested it. A coach who opens the email on a laptop, or in a
mail app that breaks the redirect, would otherwise have no way in. The confirmation template matters because
a coach's very first sign-in is sent as a signup confirmation, not as a magic link.

**Cost / consequences:** One more field on the sign-in screen. Supabase's built-in email sender is
rate-limited and only delivers to the project's own team members, so custom SMTP is required before any
coach outside the team can sign in.

---

## D-030 - Invitations expire an hour after the scheduled end, and can be reused until then

**Date:** 2026-09-12 **Status:** Accepted, interpretation **Milestone:** M6

`expires_at = scheduled_at + duration + 60 minutes`, set when the session is created and moved to the present
when it is ended. A student may join at any time before that, including before the scheduled start, and may
open the same link as often as needed. `used_at` records the first join.

**Why:** Spec section 5.1 says the link expires when the session ends and may also expire after a
configurable window; the hour allows for a lesson that starts late. Reuse is required by M5: Rejoin after a
dropped connection, and reopening the invitation after a force-close (AC-12), both need the link to keep
working. The window is a constant in `policy.ts` rather than an environment variable, so the dashboard and
the functions cannot disagree about which sessions are joinable.

**Cost / consequences:** Changing the window means redeploying both functions and the app. A forwarded link
works until it expires, but only one device can hold the student identity at a time (D-026).

---

## D-031 - Dependencies added in M6

**Date:** 2026-09-12 **Status:** Accepted **Milestone:** M6

`@supabase/supabase-js`; via `npx expo install`, so versions follow SDK 57 (D-014, D-017),
`@react-native-async-storage/async-storage` for the auth session, `expo-clipboard` for Copy link, and
`@react-native-community/datetimepicker` for Create Session; and `supabase` as a devDependency, which pins
the CLI version. The pre-call test tone is a bundled WAV played through the existing `expo-video`.

**Why:** AsyncStorage is Supabase's documented React Native storage, and a Supabase session is larger than
`expo-secure-store` handles comfortably. Reusing `expo-video` for a one-second tone avoids a second media
library, and the device preview uses LiveKit's own `createLocalVideoTrack` and `useTrackVolume`, so the
check opens the camera and microphone the same way the call does.

**Cost / consequences:** A dev-client rebuild. The auth session sits unencrypted in AsyncStorage; it holds a
refresh token and no media. `npx expo install --check` reports patch updates for several Expo packages that
predate M6; they were left unchanged. Two behaviours still need confirming on a device: whether
`useTrackVolume` reports a level for a local track before any room is joined, and whether `expo-video` plays
an audio-only file while the call audio session is active. The fallbacks are showing the meter only in the
call, and `expo-audio`.
