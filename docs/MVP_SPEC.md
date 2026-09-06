**PRODUCT SPECIFICATION**

**Live Sports Replay**

MVP specification for live 1-to-1 coaching with instant 15- and 30-second replay

**Version:** 1.0

**Status:** Ready for technical spike and user validation

**Date:** August 29, 2026

**Primary users:** Independent online sports coaches and their students

**Initial sports:** Boxing and football/soccer technique coaching

> **MVP decision:** The mobile application will not record or save calls. It will maintain only a temporary rolling buffer of the student video so the coach can replay the previous 15 or 30 seconds during the live session. The replay disappears when the session ends or the app is closed or restarted.

# Executive summary

Live Sports Replay is a React Native mobile application for private, one-to-one coaching. A coach creates a scheduled session, shares an app invitation link, and conducts a live video call similar to Zoom. During the lesson, the coach can prepare the student’s previous 15 or 30 seconds as a temporary replay without interrupting the live call. When the student is ready, the coach selects Show Replay to present it on both mobile screens while voice communication stays active.

The MVP deliberately removes permanent recording, video libraries, clipping, payments, marketplaces, and AI analysis. Its single differentiating job is to shorten the feedback loop between a movement and the coach’s correction.

## Success definition

- A coach and student can enter a stable one-to-one call through the React Native mobile app on supported iOS and Android devices.

- The coach can prepare the last 15 or 30 seconds without interrupting the student, then choose when to show the replay.

- Coach and student see the same replay and can discuss it with live microphones.

- No call or replay is available after the session ends.

# 1. Product definition

## 1.1 Problem

Generic video-call tools let coaches see and speak with students, but they do not make it effortless to revisit the movement that just happened. Coaches must ask the student to repeat the movement, use a separate camera application, or record an entire call and search through it later. That interruption weakens immediate, visual feedback.

## 1.2 Product promise

> **Core promise:** See it, replay it, correct it, and try again - all inside the same live lesson.

## 1.3 Target customer

- Primary buyer: an independent coach already providing remote or hybrid sports lessons.

- Primary operator: the coach, using the React Native app on a supported phone or tablet.

- Participant: the student, usually joining from a phone positioned on a tripod or stable surface.

- Initial use cases: boxing shadowboxing, bag work, footwork, soccer ball mastery, first touch, dribbling, and technique review in a confined area.

## 1.4 Jobs to be done

1.  Start a private remote lesson from the installed mobile app with minimal setup.

2.  Watch the student perform a movement in real time.

3.  Capture the last attempt as a temporary replay without stopping the student’s round or drill.

4.  Choose the right coaching moment to show the prepared replay.

5.  Pause, scrub, or slow the replay while verbally explaining the correction.

6.  Return to live video and let the student try again.

## 1.5 Product principles

- **Live first:** every feature must support the live lesson, not build a content library.

- **Capture now, show later:** preparing a replay must not interrupt the student’s current activity.

- **Temporary by design:** no application-level media persistence.

- **Coach controls review:** the coach owns replay timing and playback controls.

- **Student joins simply:** the invitation opens the app and no student account is required for the MVP.

# 2. MVP scope

## 2.1 Included

| **Capability**                | **MVP behavior**                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| React Native mobile app       | One shared iOS/Android application with role-specific coach and student experiences.        |
| Coach authentication          | Passwordless email link or equivalent low-friction sign-in.                                 |
| Session creation              | Coach sets title, date/time, duration, and optional student name.                           |
| Invitation link               | Unique, expiring deep link that opens the installed app and can be copied and shared.       |
| Pre-call check                | Camera, microphone, speaker, framing, and connection check.                                 |
| Live 1-to-1 call              | Student video is the main view; coach video appears as a smaller tile.                      |
| Rolling replay buffer         | Up to the latest 30 seconds of student video held temporarily during the call.              |
| Pending replay                | Coach can prepare the previous 15 or 30 seconds while the live call continues.              |
| Review controls               | Coach can play, pause, seek, and choose 0.5x or 1x playback.                                |
| Coach-controlled presentation | Coach decides when to select Show Replay; only then do both participants enter review mode. |
| Return to live                | One action restores the live student view.                                                  |
| Basic session telemetry       | Connection and feature-use events only; no media or replay content.                         |

## 2.2 Explicitly excluded

- Permanent call recording or downloadable video files

- Saved replay clips, session library, or cloud media storage

- Clip editing, titles, annotations, drawing tools, or voice-over exports

- Payments, subscriptions, coach marketplace, and lead generation

- Student accounts, progress history, homework, and messaging

- Group lessons, multiple coaches, multiple camera angles, and screen sharing

- AI movement analysis, pose estimation, summaries, or automated feedback

- Browser-based calling experience or desktop application

- Google Calendar, Outlook, Calendly, or payment integrations

- Full availability management, recurring sessions, or rescheduling workflows

## 2.3 MVP scheduling boundary

Scheduling is intentionally lightweight. The coach creates a dated session and shares its link. The MVP does not attempt to replace Calendly: students cannot browse availability, negotiate time slots, or manage recurring bookings. This preserves the original scheduling need without turning the first release into a booking platform.

# 3. Core user journey

| **Step** | **Stage**  | **User action**                                                                               | **System response**                                                                   |
| -------- | ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1        | Create     | Coach enters session name, date/time, and planned duration.                                   | Unique invitation link is generated.                                                  |
| 2        | Join       | Student opens the app invitation, enters a display name, and grants camera/microphone access. | Student reaches the in-app waiting room.                                              |
| 3        | Check      | Both participants confirm framing, sound, and connection.                                     | Join Session becomes available.                                                       |
| 4        | Coach live | Student performs while coach observes and speaks.                                             | Student video is the dominant view.                                                   |
| 5        | Prepare    | Coach selects Prepare 15s or Prepare 30s at the relevant moment.                              | A temporary replay becomes ready only on the coach interface; both users remain live. |
| 6        | Continue   | Coach waits while the student finishes a round, drill, or repetition.                         | Pending replay remains available; the live lesson is uninterrupted.                   |
| 7        | Show       | Coach selects Show Replay when the student is ready.                                          | Both screens enter synchronized review mode.                                          |
| 8        | Correct    | Coach pauses, seeks, or selects 0.5x speed while explaining.                                  | Microphones remain live.                                                              |
| 9        | Retry      | Coach selects Return to Live.                                                                 | Student performs the correction.                                                      |
| 10       | End        | Coach ends the session.                                                                       | Temporary media buffer and pending replay objects are destroyed.                      |

## 3.1 Replay interaction

1.  The Prepare 15s and Prepare 30s buttons remain unavailable until the corresponding amount of history exists.

2.  When the coach presses Prepare 15s or Prepare 30s, the application creates a temporary pending replay from the immediately preceding interval.

3.  Preparing a replay does not change the student screen or enter review mode. Both participants remain in the live call.

4.  The coach sees Replay Ready with its duration and a Show Replay action. The coach can wait until the student finishes a round or is ready to focus on feedback.

5.  When the coach presses Show Replay, the prepared replay replaces the current student video on both screens and begins at its first frame.

6.  Coach and student audio remains live. The coach can play, pause, scrub, replay from the start, and switch between 0.5x and 1x speed.

7.  The student can see playback status but cannot control it in the MVP.

8.  Return to Live restores the live view. The rolling buffer continues operating in the background, so another replay can be prepared later.

## 3.2 Empty and degraded states

- Before 15 seconds: both prepare buttons show a short countdown or disabled state.

- Between 15 and 30 seconds: Prepare 15s is available; Prepare 30s remains disabled.

- If video is interrupted: prepare buttons disable until a continuous 15-second window is available again.

- If synchronized replay fails: coach receives a clear retry option and the call remains live.

- If a replay is already pending: preparing another replay requires replacing the current pending replay; only one pending replay is supported in the MVP.

- If the peer connection drops: the application attempts reconnection and does not preserve the previous replay buffer after an app restart.

# 4. Screen and interaction requirements

| **Screen**           | **Required elements**                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Coach dashboard      | Upcoming sessions, Create Session, copy invite link, open session.                                                                 |
| Create session       | Title, date/time, duration, optional student name, Create button.                                                                  |
| Student join screen  | Coach/session identity, scheduled time, display name, privacy notice, Join Check.                                                  |
| Pre-call check       | Camera preview, microphone level, device selectors, framing guidance, connection result.                                           |
| Live coach view      | Large student video, small coach tile, mute/camera/end controls, Prepare 15s, Prepare 30s, and pending Replay Ready state.         |
| Live student view    | Large coach or self-context view as designed, connection status, mute/camera/end controls; remains live while a replay is pending. |
| Pending replay state | Coach-only Replay Ready card with duration, Show Replay, Replace, and Discard actions.                                             |
| Replay mode          | Large replay, timeline, elapsed/total time, play/pause, 0.5x/1x, Restart, Return to Live.                                          |
| Session ended        | Simple confirmation; no video or replay is available.                                                                              |

## 4.1 Live coach layout

- The student video uses most of the available viewport and preserves the camera aspect ratio.

- Replay controls use large, accessible touch targets that can be operated quickly during a lesson.

- A visible LIVE label differentiates live mode from replay mode.

- Preparing a replay shows a coach-only Replay Ready state and never interrupts the student view.

- The interface displays connection quality without exposing technical jargon.

- The coach’s camera tile must not cover the student’s feet or lower-body movement.

## 4.2 Replay mode

- Only Show Replay changes the mode label from LIVE to REVIEWING LAST 15 SECONDS or REVIEWING LAST 30 SECONDS.

- Both participants see the same approximate playback position; coach commands are authoritative.

- The student sees that the coach controls playback.

- Live microphones continue; the replay audio is muted by default to avoid echo and distraction.

- Returning live must take one click and should complete in under one second.

> **UX constraint:** The replay is not a saved clip. Avoid download icons, libraries, filenames, thumbnails, or language that suggests the footage will remain available after the call.

# 5. Functional requirements

| **ID** | **Capability**           | **Requirement**                                                                                                                    | **Priority** |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| FR-01  | Coach access             | Coach can sign in and access only sessions they created.                                                                           | Must         |
| FR-02  | Create session           | Coach can create a dated 1-to-1 session and receive a unique invitation link.                                                      | Must         |
| FR-03  | Guest join               | Student can open an invitation in the installed app and join with a display name without creating an account.                      | Must         |
| FR-04  | Consent                  | Both users must acknowledge the temporary replay buffer before joining.                                                            | Must         |
| FR-05  | Device check             | Users can preview and select camera and microphone before entering.                                                                | Must         |
| FR-06  | Live media               | System transmits two-way audio and video in a private 1-to-1 session.                                                              | Must         |
| FR-07  | Rolling buffer           | Coach client retains up to 30 seconds of the incoming student video in temporary application memory.                               | Must         |
| FR-08  | Prepare 15-second replay | Coach can prepare the 15 seconds immediately preceding the request as a pending replay.                                            | Must         |
| FR-09  | Prepare 30-second replay | Coach can prepare the 30 seconds immediately preceding the request as a pending replay.                                            | Must         |
| FR-10  | Delayed presentation     | Preparing a replay does not change the student view; coach must select Show Replay before it is presented through the active call. | Must         |
| FR-11  | Playback control         | Coach can play, pause, seek, restart, and select 0.5x or 1x speed.                                                                 | Must         |
| FR-12  | Live audio               | Two-way microphone audio continues during replay.                                                                                  | Must         |
| FR-13  | Return live              | Coach can restore live video without reconnecting the call.                                                                        | Must         |
| FR-14  | Repeat replay            | Coach can use replay multiple times in one session.                                                                                | Must         |
| FR-15  | No persistence           | Application does not upload or persist call/replay media to accounts or cloud storage.                                             | Must         |
| FR-16  | Cleanup                  | Media chunks, temporary files/objects, and replay tracks are destroyed on end, leave, app restart, or fatal disconnect.            | Must         |
| FR-17  | End session              | Coach can end the session for both participants.                                                                                   | Must         |
| FR-18  | Connection feedback      | Users receive understandable states for connecting, reconnecting, weak connection, and failure.                                    | Must         |

## 5.1 Business rules

- A session supports exactly one coach and one student.

- The invitation link expires when the session ends and may also expire after a configurable post-session window.

- Only the coach can trigger or control replay.

- The MVP supports one pending replay at a time; preparing another replaces the existing pending replay after confirmation.

- Only the student camera stream is included in the rolling replay buffer.

- Replay audio is excluded or muted; live microphones remain the communication channel.

- No administrative interface can retrieve replay media because the backend never receives a recording artifact.

# 6. Acceptance criteria

| **ID** | **Acceptance condition**                                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01  | A coach creates a session and copies a student link in under one minute.                                                                      |
| AC-02  | A student opens an invitation in the React Native app and joins on a supported iOS or Android device without creating an account.             |
| AC-03  | Both participants can hear and see each other after granting permissions.                                                                     |
| AC-04  | Prepare 15s is disabled until 15 seconds of continuous student video is available.                                                            |
| AC-05  | Prepare 30s is disabled until 30 seconds of continuous student video is available.                                                            |
| AC-06  | Selecting Prepare 15s creates a pending replay of the preceding 15 seconds, within a tolerance of one second, while the student remains live. |
| AC-07  | Selecting Prepare 30s creates a pending replay of the preceding 30 seconds, within a tolerance of one second, while the student remains live. |
| AC-08  | Only after the coach selects Show Replay do coach and student see the pending replay and remain able to speak to each other.                  |
| AC-09  | Coach play/pause, seek, restart, and speed commands are reflected on the student screen.                                                      |
| AC-10  | Return to Live restores the student’s current camera view without rejoining.                                                                  |
| AC-11  | A coach can complete at least ten prepare/show replay cycles in one call without restarting the app or causing material memory growth.        |
| AC-12  | Leaving, force-closing, or restarting the app clears the prior replay; reopening the invitation cannot recover it.                            |
| AC-13  | Backend logs contain session/event metadata but no video, audio, frames, blobs, object URLs, or media payloads.                               |
| AC-14  | A dropped connection produces a recoverable error state; failure of replay does not automatically end the live call.                          |

## 6.1 Supported environment for the pilot

- Coach: React Native pilot build on a supported iOS or Android phone or tablet.

- Student: the same React Native pilot build on a supported iOS or Android phone or tablet.

- Network target: stable broadband or strong Wi-Fi; cellular is best-effort for the first pilot.

- Video target: 720p at up to 30 fps, adapting downward when bandwidth is limited.

> **Early spike requirement:** The React Native build must prove incoming-track buffering and shared replay on both iOS and Android before committing to the full UI. If one platform is unreliable, the pilot should use a clearly defined device/OS matrix rather than introduce server recording.

# 7. Proposed technical design

## 7.1 Architecture

Use one React Native mobile application with role-specific coach and student experiences, plus a managed WebRTC service or well-supported React Native WebRTC integration for signaling, NAT traversal, and live media reliability. The backend stores only coach accounts, session metadata, invitation tokens, and non-media events.

| **Component**                | **Responsibility**                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| React Native app - coach     | Session controls, incoming student video, temporary rolling buffer, replay playback, replay-track presentation. |
| React Native app - student   | Deep-link join flow, camera/microphone publishing, live/replay viewing, playback-state display.                 |
| Application backend          | Authentication, session CRUD, signed invitation/deep-link tokens, authorization, telemetry metadata.            |
| WebRTC signaling/media layer | Connects participants, relays media when peer-to-peer is unavailable, carries replay control messages.          |
| Database                     | Coach and session metadata only. No media columns, objects, or recording references.                            |

## 7.2 Temporary replay mechanism

1.  The coach’s React Native client receives the student video track through the live WebRTC connection.

2.  A native media pipeline produces short chunks, ideally one second each, and retains only the newest 30 to 35 seconds in a bounded, temporary ring buffer on the coach device.

3.  When Prepare 15s or Prepare 30s is selected, the mobile client assembles only the required interval into a temporary local media object.

4.  The mobile client marks that object as the pending replay and displays Replay Ready only to the coach. The live video call continues unchanged for both users.

5.  The pending replay remains temporary while the coach waits for an appropriate feedback moment. The MVP retains only one pending replay at a time.

6.  When the coach selects Show Replay, the coach client plays the pending replay and publishes it to the student as a temporary presentation/replay video track in the existing call. The live microphone tracks remain unchanged.

7.  Playback control messages travel through the call’s data channel or control channel so the student view follows the coach’s play, pause, seek, restart, and speed actions.

8.  Return to Live removes the presentation track and restores the ordinary live layout.

9.  When a replay is replaced or the call ends, object URLs, media chunks, canvas/capture tracks, and references are explicitly revoked or stopped.

> **Important technical meaning of “no recording”:** The application must temporarily encode and retain recent media to enable replay. The requirement is no application-level persistence: no call or clip is uploaded, saved to an account, written to product storage, or recoverable after cleanup. React Native and mobile operating-system memory management cannot be described as a guarantee that bytes never touch device-managed storage.

## 7.3 Recommended implementation sequence

- Prove a local 30-second ring buffer from an incoming WebRTC track.

- Prove preparation of a pending replay without changing either participant’s live view or interrupting audio.

- Prove delayed presentation of that replay after Show Replay is selected between two React Native devices on iOS and Android.

- Prove synchronized controls and return-to-live behavior.

- Only then build scheduling, dashboard polish, and telemetry.

## 7.4 Minimal data model

| **Entity**    | **Minimum fields**                                                                |
| ------------- | --------------------------------------------------------------------------------- |
| Coach         | id, email, display_name, created_at                                               |
| Session       | id, coach_id, title, scheduled_at, duration_minutes, status, created_at, ended_at |
| Invitation    | id, session_id, token_hash, expires_at, used_at or join state                     |
| Session event | session_id, event_type, actor_role, timestamp, non-media metadata                 |

# 8. Non-functional requirements

| **ID** | **Area**                | **Requirement**                                                                                                                           |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Replay readiness        | Replay Ready appears within 2 seconds after Prepare; replay appears within 2 seconds after Show Replay at p95 under supported conditions. |
| NFR-02 | Control synchronization | Playback positions differ by no more than approximately 500 ms during normal conditions.                                                  |
| NFR-03 | Return live             | Live view is restored within 1 second without reconnecting.                                                                               |
| NFR-04 | Call continuity         | Replay failure does not terminate the active audio/video call.                                                                            |
| NFR-05 | Memory bound            | Rolling chunks remain capped; repeated replays do not create unbounded memory growth.                                                     |
| NFR-06 | Adaptive media          | Live call reduces resolution/bitrate before failing when bandwidth deteriorates.                                                          |
| NFR-07 | Transport security      | All application traffic uses TLS; WebRTC media uses encrypted transport.                                                                  |
| NFR-08 | Authorization           | Only invited participants can enter a session; tokens are high entropy and expire.                                                        |
| NFR-09 | Privacy                 | No product media persistence, recording API, media bucket, or media backup is enabled.                                                    |
| NFR-10 | Observability           | Errors and timing metrics exclude media payloads and sensitive invitation tokens.                                                         |
| NFR-11 | Accessibility           | Controls have accessible labels, sufficient contrast, large touch targets, and screen-reader support.                                     |
| NFR-12 | Mobile layouts          | Coach and student interfaces support portrait and landscape on the pilot phone/tablet matrix.                                             |

## 8.1 Privacy and consent requirements

- The join screen explains that the latest 30 seconds are temporarily available for in-call replay.

- Both users acknowledge the notice before entering the call.

- The interface never uses the word “recording” without immediately clarifying that nothing is saved after the session.

- If minors are allowed in the pilot, the coach must confirm they have appropriate guardian authorization; full compliance design is a post-validation workstream.

- Privacy documentation must distinguish session metadata from media content.

## 8.2 Suggested user-facing privacy text

> **Temporary replay:** During this live session, the most recent 30 seconds of the student video are held temporarily on the coach’s device so the coach can replay a movement. Nothing is saved to your account or to a video library. The temporary replay is cleared when the session ends or the app is closed or restarted.

# 9. Pilot measurement

## 9.1 Primary success metrics

| **Metric**         | **Pilot target**                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Connection success | At least 80% of scheduled pilot sessions connect without operator support.                                           |
| Replay adoption    | At least 60% of completed sessions use replay at least once.                                                         |
| Replay reliability | At least 95% of prepare requests create a pending replay and at least 95% of Show Replay requests enter review mode. |
| Replay latency     | p95 time from Prepare to Replay Ready and from Show Replay to visible replay is no more than 2 seconds.              |
| Repeat value       | Median of at least 3 prepare/show cycles among sessions that use replay.                                             |
| Coach preference   | At least 70% of pilot coaches prefer the workflow to repeating the movement or using a separate camera app.          |
| Privacy integrity  | Zero persisted media objects and zero media payloads in logs or analytics.                                           |

## 9.2 Events that may be collected

- session_created, participant_join_attempted, participant_connected, session_ended

- replay_15_prepared, replay_30_prepared, replay_replaced, replay_discarded, replay_shown, replay_failed, returned_live

- permission_denied, connection_degraded, reconnection_started, reconnection_succeeded

- Durations and error codes may be collected; no media bytes, image frames, filenames, or invitation tokens may be collected.

# 10. Risks and mitigations

| **Risk**                                                    | **Severity** | **MVP mitigation**                                                                                                                                               |
| ----------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared replay differs across iOS and Android                | High         | Run a React Native media spike first; constrain the pilot device/OS matrix if needed; do not add server recording as a shortcut.                                 |
| Fast movement looks blurred at 30 fps                       | High         | Encourage lighting and framing guidance; target 720p/30 fps; validate whether 0.5x replay remains useful.                                                        |
| Student moves out of frame                                  | High         | Pre-call framing guide, tripod recommendation, and full-body preview.                                                                                            |
| Weak network reduces replay quality                         | Medium       | Use the coach-received track as the authoritative replay; show clear connection state; maintain live audio.                                                      |
| Replay buffer increases mobile memory or heat               | Medium       | Use one-second chunks, strict ring-buffer limits, immediate cleanup, and device memory/thermal soak tests.                                                       |
| Pending replay remains too long or is replaced accidentally | Medium       | Support one pending replay, show its duration clearly, require confirmation before replacement, and clear it after review, discard, replacement, or session end. |
| Users misunderstand “no recording”                          | Medium       | Use precise temporary-replay language and visible privacy notice.                                                                                                |
| Scheduling expands into a separate product                  | Medium       | Keep session creation and shareable links only; defer availability and integrations.                                                                             |
| Competitors copy the feature                                | Medium       | Win through sport-specific UX, low friction, and direct coach interviews rather than broad feature count.                                                        |

# 11. Delivery plan

A realistic first pilot is approximately six focused development weeks for one experienced full-time builder, with additional time if cross-platform React Native media integration requires substantial native work. A part-time build should expect a longer calendar duration.

| **Week** | **Focus**          | **Work**                                                                                                    | **Exit result**                   |
| -------- | ------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 0        | Technical spike    | React Native incoming-track buffer; local replay; temporary replay track across iOS/Android; cleanup proof. | Go/no-go evidence                 |
| 1        | Session foundation | Coach sign-in, session creation, deep-link invitation, join screen, waiting room.                           | Private scheduled session         |
| 2        | Live call          | 1-to-1 WebRTC, camera/microphone permissions, mobile layouts, mute/camera/end controls.                     | Stable live coaching call         |
| 3        | Replay core        | 15/30-second buffer, pending replay, coach-only ready/replace/discard states.                               | Non-disruptive replay preparation |
| 4        | Shared review      | Show Replay, student presentation, synchronized controls, speed, return live.                               | Coach-timed feedback loop         |
| 5        | Hardening          | Reconnect states, device matrix, memory soak, privacy cleanup, security review.                             | Pilot-ready reliability           |
| 6        | Pilot              | Telemetry, coach onboarding, 5-10 coach sessions, interview synthesis.                                      | Validated next decision           |

## 11.1 Go/no-go gates

- **Gate 1 - Feasibility:** shared replay works reliably on the chosen coach and student React Native device pair.

- **Gate 2 - Usability:** coaches can prepare a replay, wait, show it at the right moment, and return live without explanation.

- **Gate 3 - Value:** coaches use replay repeatedly and describe it as meaningfully better than asking for another repetition.

- **Gate 4 - Commercial interest:** at least three target coaches agree to continue using or pay for a private beta.

## 11.2 Post-MVP candidates

Only after the replay workflow is validated, evaluate the following in this order:

- Simple coach availability and student self-booking

- Coach drawing or freeze-frame annotation during replay

- Optional locally saved coaching moments with explicit consent

- Session notes and homework

- Coach subscriptions and payment collection

- Sport-specific framing guides and remote camera control

- Asynchronous video review

- AI-assisted summaries or movement analysis

# 12. Open decisions before implementation

| **Decision**          | **Options**                                      | **Recommended MVP choice**                                                                                                                |
| --------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| WebRTC implementation | Managed service/abstraction vs. direct WebRTC    | Use a managed option for the pilot unless the technical spike proves direct peer-to-peer is clearly simpler.                              |
| Replay presentation   | Temporary presentation track vs. chunk transfer  | Prefer a temporary video/presentation track so playback can begin without transferring a full 30-second blob.                             |
| Pending replay policy | One pending replay vs. a replay queue            | Support one pending replay for the MVP; require confirmation before replacing it.                                                         |
| React Native setup    | Managed/prebuilt workflow vs. bare React Native  | Use the lightest setup that supports the required native WebRTC and replay modules; do not assume a generic preview client is sufficient. |
| Pilot devices         | Broad iOS/Android support vs. constrained matrix | Target both platforms, but validate and publish a small supported device/OS matrix for the pilot.                                         |
| Replay audio          | Recorded replay audio vs. live microphones       | Mute replay audio and preserve live microphones.                                                                                          |
| Session duration      | Fixed vs. configurable                           | Allow 30, 45, or 60 minutes; do not enforce billing rules.                                                                                |

> **Recommended immediate next action:** Build a two-device React Native technical prototype with no accounts or scheduling. Prove that a coach can prepare the previous 15/30 seconds without changing the student’s live view, wait while the student finishes a round, then select Show Replay across supported iOS and Android devices while live audio remains active. This spike should happen before the polished MVP is built.
