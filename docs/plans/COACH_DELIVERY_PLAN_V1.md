# FrameCue — coach-friendly delivery plan

## Purpose of this document

This document turns the technical plan in `PLAN_V1.md` into a list of clear, visible results.

It explains:

- what will be delivered;
- what the coach and student will be able to do;
- how each delivery will be demonstrated;
- what must be proven before work moves forward.

This is a delivery plan, not a statement that every item is already complete. One milestone must be
approved and completed before the next milestone begins.

## The final result

At the end of the MVP, a coach will be able to:

1. Sign in without a password.
2. Create a private lesson and send the student an invitation link.
3. Check the camera, microphone, connection, and framing before the lesson.
4. See and speak with one student in a live mobile video call.
5. Prepare the student's previous 15 or 30 seconds without interrupting the lesson.
6. Wait until the student is ready before showing the replay.
7. Show the same replay on both screens.
8. Play, pause, move backward or forward, restart, and use half speed while both people continue talking.
9. Return to the live student camera in one action.
10. Repeat this coaching loop several times during the same lesson.

No call or replay will be saved to a FrameCue account, video library, or cloud storage.

## What FrameCue will not include in the MVP

The first version will not include:

- permanent recordings or downloadable clips;
- a video library;
- drawing, annotations, clip editing, or voice-over exports;
- student accounts or progress histories;
- payments, subscriptions, or a coach marketplace;
- group lessons or multiple cameras;
- browser or desktop calling;
- calendar integrations or a full booking system;
- messaging, homework, or artificial-intelligence analysis.

These boundaries protect the main goal: make immediate visual feedback easier during a live lesson.

## Why the product is built in this order

The replay is the hardest and most important part of FrameCue. The team will prove that it works before
spending time polishing accounts, scheduling, and dashboards.

This means the build order is different from the order a coach will eventually use the app:

1. Establish a dependable app foundation.
2. Prove a real two-person video call.
3. Prove that the student's recent video can become a temporary replay.
4. Add the complete replay experience.
5. Make it reliable and private.
6. Add sign-in, sessions, and invitations.
7. Finish accessibility and mobile layouts.
8. Prove the same replay experience on iPhone and iPad.

## Milestone 0 — dependable app foundation

### Outcome

A basic FrameCue Android app can be installed and opened. The project has repeatable safety checks so new
work is less likely to break existing work.

### Deliverables

- An installable Android development version of FrameCue.
- A simple placeholder screen proving the app launches.
- Automatic checks for programming errors, code quality, and expected behavior.
- Safe handling of private service settings so they are not accidentally published.
- Written records explaining how the product is built and why important technical choices were made.
- A repeatable setup for the development computer and Android build tools.

### Proof required before approval

- The app installs and opens on a real Android device.
- The full automatic verification command passes.
- A development build can be recreated from the documented setup.
- No private service keys are included in the shared project files.

## Milestone 1 — real two-person live call

### Outcome

A coach and student can see and hear each other in a private test call on two Android devices.

### Deliverables

- Camera and microphone permission screens.
- Two-way live video and audio.
- A large view of the student on the coach's screen.
- A smaller coach camera view positioned so it does not cover the student's feet or lower body.
- Mute, camera on/off, and leave controls.
- A clear `LIVE` label.
- Plain-language messages such as Connecting, Reconnecting, Weak Connection, and Unable to Connect.
- Automatic reduction of video quality when the connection becomes weaker, where possible.

### Proof required before approval

- Two real Android devices join the same call.
- Both people can see and hear each other.
- Mute, camera on/off, and leave work on both devices.
- The student's whole-body movement remains visible in the coach layout.

This milestone does not yet include accounts, invitation links, or replay.

## Milestone 2 — prove the Android replay engine

### Outcome

FrameCue proves that it can temporarily hold the student's most recent video and create an accurate
15-second or 30-second replay without disturbing the live call.

This is the first major continue-or-stop decision for the project.

### Deliverables

- A temporary rolling window containing only the newest 30 to 35 seconds of student video.
- Only the student's incoming video is included.
- A test control that prepares the immediately preceding 15 or 30 seconds.
- A temporary replay file that exists only inside the app while needed.
- Automatic deletion when the replay is discarded, the call ends, the app closes, or a serious
  disconnection occurs.
- A test screen where the prepared replay can be watched on the coach device.
- Protection against unlimited memory use or increasing memory after repeated replays.

### What must remain unchanged

- The student continues seeing the live call.
- Both people continue hearing each other.
- Preparing a replay never starts review mode.
- A replay error does not end the live call.

### Proof required before approval

- Prepare 15 seconds returns the immediately preceding 15 seconds, within one second of the requested
  length.
- Prepare 30 seconds returns the immediately preceding 30 seconds, within one second of the requested
  length.
- The live picture and sound continue while each replay is prepared.
- At least ten replays can be prepared without meaningful memory growth.
- Temporary replay material is removed after cleanup.

### Decision after this milestone

If the proof succeeds, continue to Milestone 3.

If it fails, stop and reassess the mobile technology or supported devices. FrameCue must not solve the
problem by recording calls on a server.

## Milestone 3 — coach prepares and manages one replay

### Outcome

The coach gets the complete private preparation experience while the student remains in the live lesson.

### Deliverables

- `Prepare 15s` stays unavailable until 15 continuous seconds of student video exist.
- `Prepare 30s` stays unavailable until 30 continuous seconds exist.
- A clear countdown or unavailable state tells the coach when each option will become ready.
- A video interruption resets the available history and temporarily disables preparation.
- A coach-only `Replay Ready` card shows the replay length.
- The card provides `Show Replay`, `Replace`, and `Discard`.
- Only one replay can wait at a time.
- Replacing an existing replay requires confirmation.
- The coach can privately check the replay using play, pause, move through the timeline, restart, and
  0.5x or 1x speed.

### Proof required before approval

- The two Prepare buttons become available at the correct times.
- Each prepared replay contains the correct immediately preceding movement.
- Preparing, checking, replacing, or discarding a replay does not change the student's screen.
- An accidental second Prepare cannot silently destroy the waiting replay.

## Milestone 4 — shared replay on both screens

### Outcome

The coach chooses the teaching moment, shows the prepared replay on both devices, controls it, and returns
both people to the live lesson.

### Deliverables

- The temporary replay is securely sent to the student after preparation while the live lesson continues.
- `Show Replay` is the only action that changes both screens from live mode to review mode.
- Both screens start the replay at the beginning.
- The coach controls play, pause, timeline position, restart, and 0.5x or 1x speed.
- The student's screen follows the coach and does not provide student replay controls.
- Both screens show `REVIEWING LAST 15 SECONDS` or `REVIEWING LAST 30 SECONDS`.
- The student sees a clear message that the coach controls playback.
- Replay sound is muted to avoid echo.
- Live microphones remain active so the coach and student can keep talking.
- `Return to Live` restores the current student camera without reconnecting the call.
- A clear waiting or retry state appears if the replay has not finished reaching the student.

### Proof required before approval

- Preparing a replay still leaves the student's screen live.
- Only `Show Replay` starts shared review.
- The replay becomes visible within two seconds under supported connection conditions.
- Coach and student playback remain within about half a second of each other.
- Every coach playback action is reflected on the student's screen.
- `Return to Live` restores live video within one second.
- A replay problem leaves the live call usable.

## Milestone 5 — reliability, cleanup, and difficult conditions

### Outcome

The replay loop can be used repeatedly in a real lesson, and temporary footage is reliably removed.

### Deliverables

- Cleanup when either person leaves, the session ends, the app closes, the app restarts, or the connection
  fails completely.
- Recovery messages and retry actions after a dropped or weak connection.
- Separation between call problems and replay problems so one does not unnecessarily end the other.
- Repeated-use checks for memory growth, device heat, and stability.
- Proof that an old replay cannot be recovered by reopening the app or invitation.
- Clear, coach-friendly errors instead of technical messages.

### Proof required before approval

- At least ten full Prepare, Show Replay, and Return to Live cycles work in one call.
- Memory remains bounded and the device does not show unacceptable heating during the test.
- Force-closing and reopening the app does not restore the old replay.
- A replay failure does not automatically end live audio or video.
- A dropped call shows a recoverable state where recovery is possible.

## Milestone 6 — coach account, sessions, and student invitations

### Outcome

The technical prototype becomes a usable private lesson flow.

### Deliverables for the coach

- Password-free email sign-in.
- A dashboard listing the coach's sessions.
- A Create Session form with:
  - session title;
  - date and time;
  - 30, 45, or 60 minute planned duration;
  - optional student name.
- A unique invitation link that can be copied and shared.
- Access only to sessions created by that coach.
- An End Session action that closes the lesson for both people.

### Deliverables for the student

- An invitation link that opens the installed FrameCue app.
- Join without creating a student account.
- A display-name field.
- Session and coach details.
- A pre-call waiting and device-check experience.
- A simple session-ended screen.

### Privacy and access deliverables

- Both people must accept a clear temporary-replay notice before joining.
- Invitations are difficult to guess and expire.
- Only invited participants can enter the lesson.
- The service stores account, session, invitation, and non-video activity information only.
- Cloud video storage is not enabled.

### Proof required before approval

- A coach creates a session and copies the invitation in under one minute.
- A student opens the invitation and joins without making an account.
- Camera, microphone, speaker, framing, and connection can be checked before joining.
- A coach cannot access another coach's sessions.
- An expired or ended invitation cannot start a session.

## Milestone 7 — privacy review, accessibility, and mobile layouts

### Outcome

FrameCue is understandable and usable across the supported pilot devices and does not leak temporary
footage through product logs.

### Deliverables

- Large touch targets suitable for use during a lesson.
- Accessible names for controls and support for screen readers.
- Readable color contrast.
- Coach and student screens that work in portrait and landscape.
- Layout checks on the supported pilot phones and tablets.
- Connection and replay measurements that contain no video, audio, image frames, replay files, or private
  invitation tokens.
- Product language that consistently explains that replay is temporary.
- A privacy review confirming that no cloud media store or server recording is enabled.

### Proof required before approval

- Core controls can be understood and operated with accessibility tools.
- Important movement is not hidden in portrait or landscape.
- Logs contain only approved lesson and feature events.
- No media content or invitation secret appears in logs.
- No replay can be found after the required cleanup events.

## Milestone 8 — iPhone and iPad replay support

### Outcome

The same live and replay experience proven on Android is implemented and tested on supported Apple
devices.

### Deliverables

- The 30-second temporary replay window on supported iPhones and iPads.
- Prepare 15s and Prepare 30s with the same behavior as Android.
- Shared replay, synchronized coach controls, live microphones, and Return to Live.
- Apple development builds produced through the approved build service.
- A small, published list of supported pilot devices and operating-system versions.
- Cross-platform tests using Android and Apple device combinations.

### Proof required before approval

- The Milestones 2 through 5 replay tests pass on supported Apple devices.
- Android-to-Apple and Apple-to-Android calls complete the full replay loop.
- Performance, memory, heat, cleanup, and timing meet the same pilot targets.
- Any unsupported device or operating-system version is clearly documented.

This milestone is required before FrameCue can claim that the replay has been proven across both supported
mobile platforms.

## Final pilot delivery

When all required milestones are approved, the pilot package will contain:

- installable Android and Apple pilot builds;
- a published supported-device list;
- the complete coach and student lesson journey;
- clear temporary-replay consent text;
- coach-facing setup and framing guidance;
- connection and replay measurements that exclude media;
- a known-limitations list;
- a repeatable pilot test script.

The pilot should then be used in 5 to 10 real coaching sessions.

## Pilot success checks

The pilot is successful enough to consider a private beta when:

- at least 80% of scheduled pilot sessions connect without technical help;
- at least 60% of completed sessions use replay;
- at least 95% of Prepare requests produce a replay;
- at least 95% of Show Replay requests enter review mode;
- replay appears within two seconds in at least 95% of supported cases;
- sessions that use replay have a median of at least three replay cycles;
- at least 70% of pilot coaches prefer FrameCue's workflow to asking for another repetition or using a
  separate camera app;
- no media is found in product storage, logs, or analytics.

## Product decision gates

### Gate 1 — can it work?

The temporary replay works reliably on the chosen Android devices after Milestone 2. Full cross-platform
proof is completed in Milestone 8.

### Gate 2 — can a coach use it naturally?

A coach can prepare a replay, keep watching the live student, wait for the right moment, show the replay,
explain the correction, and return to live without assistance.

### Gate 3 — does it improve coaching?

Coaches use replay several times and say it is meaningfully better than asking the student to repeat the
movement or switching to another camera app.

### Gate 4 — is there continued interest?

At least three target coaches agree to continue using FrameCue or pay for a future private beta.

## Rules that apply to every milestone

A milestone is complete only when:

1. Its listed deliverables are present.
2. Its automatic checks pass.
3. Its real-device demonstrations pass.
4. Temporary video remains private and disposable.
5. Known limitations are written down.
6. Important technical choices are recorded.
7. The completion report states:
   - what was delivered;
   - which files changed;
   - which checks were performed;
   - what remains limited;
   - the recommended next milestone.

No milestone starts automatically. The next milestone begins only after the current result is reviewed and
approved.

## Plain-language glossary

- **Live call:** The current camera and microphone conversation between coach and student.
- **Temporary replay:** The student's recent video held only long enough to review during the lesson.
- **Prepare:** Create a temporary 15-second or 30-second replay without showing it to the student.
- **Pending replay:** One prepared replay waiting for the coach to select Show Replay.
- **Review mode:** The screen where both people see the same replay while continuing to talk.
- **Return to Live:** Leave review mode and show the student's current camera again.
- **Pilot:** A limited real-world trial with selected coaches, students, devices, and network conditions.
- **Supported device list:** The specific phones, tablets, and operating-system versions proven to work.
- **Automatic checks:** Repeatable project tests that catch common errors before a build is approved.
