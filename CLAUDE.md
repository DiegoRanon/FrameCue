# FrameCue development instructions

FrameCue is a React Native mobile app for private one-to-one sports coaching.

## Core MVP workflow

- Coach and student join a live video call.
- Only the student's incoming video is temporarily buffered.
- The coach can prepare the previous 15 or 30 seconds.
- Preparing a replay must not interrupt or change the student's live screen.
- The coach decides when to select Show Replay.
- Live microphones remain active during replay.
- No media is uploaded or permanently stored.
- Only one pending replay exists at a time.

## Development rules

- Read docs/MVP_SPEC.md before planning a feature.
- Implement one approved milestone at a time.
- Do not add features outside the MVP specification.
- Prefer simple, maintainable solutions over premature abstractions.
- Never introduce server-side recording.
- Run type checking, linting, and relevant tests before completing a task.
- Do not claim success when a test or required verification has not run.
- Record significant technical decisions in docs/DECISIONS.md.
- Ask before changing an approved architectural decision.

## Completion report

At the end of each task, report:

1. What was implemented
2. Files changed
3. Tests and checks performed
4. Known limitations
5. Recommended next task
