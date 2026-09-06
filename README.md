# FrameCue

React Native app for private one-to-one sports coaching. During a live lesson the coach can prepare the
student's previous 15 or 30 seconds and choose when to show that replay on both screens, without
interrupting the student and without anything being recorded or saved.

- Product specification: `docs/MVP_SPEC.md`
- Technical decisions: `docs/DECISIONS.md`
- Architecture: `docs/ARCHITECTURE.md`
- Working agreement for contributors and agents: `CLAUDE.md`

## Status

Milestone 1 - live 1-to-1 call. Pick a role on the development home screen and join; the other participant
fills the stage, your own camera sits in a small tile, with mute, camera, and leave controls. Replay comes
in M2-M4. A LiveKit project is required to run a real call.

## Requirements

- Node 20.19+ or 22 LTS. Node 21.0.0 works with this project but is past end of life; see D-009 in
  `docs/DECISIONS.md` for why `.env` files are avoided on it
- Android SDK (platform 36, build-tools 36) and a physical Android device with USB debugging
- JDK 17 - Android Studio's bundled JBR is used automatically by `scripts/android-jdk.mjs`

Expo Go will not work: the app depends on native modules and needs a dev-client build.

## Setup

```bash
npm install
cp framecue.local.example.json framecue.local.json   # then fill in the LiveKit values
npm run prebuild:android                             # generates android/ and pins the Gradle JDK
npm start                                            # Metro, in its own terminal
npm run android                                      # builds, installs, launches
```

Get the LiveKit values from a LiveKit Cloud project: the project URL, plus one token per role, because two
devices need two identities or the second connection evicts the first.

```bash
lk token create --api-key <key> --api-secret <secret>   --join --room framecue-dev --identity coach --valid-for 24h
```

**Configuration is embedded in the app at build time.** After editing `framecue.local.json`, run
`npm run android` again - restarting Metro is not enough (D-010).

`npm run android` drives adb directly ([scripts/android-run.mjs](scripts/android-run.mjs)) instead of
using `expo run:android`. Expo's runner calls `adb -s <id> emu avd name` on every device adb reports; any
unrelated Windows service listening on a port in adb's emulator scan range (5555-5585) makes adb invent a
phantom offline emulator, and that one failing call aborts the run. Targeting an online device sidesteps it.

- `npm run android -- --device emulator-5554` or `FRAMECUE_ANDROID_DEVICE=...` to choose a device
- `npm run android:install` to reinstall without rebuilding
- `npm run android:expo` for the stock `expo run:android` path

## Checks

```bash
npm run verify   # typecheck, lint, format check, tests
```

Everything from M1 onward is proven on real devices as well; see the verification notes in each milestone.
