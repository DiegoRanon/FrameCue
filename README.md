# FrameCue

React Native app for private one-to-one sports coaching. During a live lesson the coach can prepare the
student's previous 15 or 30 seconds and choose when to show that replay on both screens, without
interrupting the student and without anything being recorded or saved.

- Product specification: `docs/MVP_SPEC.md`
- Technical decisions: `docs/DECISIONS.md`
- Architecture: `docs/ARCHITECTURE.md`
- Working agreement for contributors and agents: `CLAUDE.md`

## Status

Milestone 6 - the session foundation. A coach signs in with an emailed link or code, creates a dated
session, and copies or shares an invitation link. The student taps the link, which opens the app, enters a
name, acknowledges the temporary-replay notice, checks camera, microphone, and sound, and joins without an
account. LiveKit credentials are issued per participant by Supabase edge functions, and End Session closes
the lesson on both devices.

The replay loop from M2-M5 is unchanged: the coach prepares the last 15 or 30 seconds, the clip transfers in
the background, and Show Replay puts it on both screens under the coach's control while both microphones stay
live. Nothing survives a leave, a force-close, or a dropped connection.

Running a real session needs a hosted Supabase project, a LiveKit Cloud project, and an https invite host.

## Requirements

- Node 20.19+ or 22 LTS. Node 21.0.0 works with this project but is past end of life; see D-009 in
  `docs/DECISIONS.md` for why `.env` files are avoided on it
- Android SDK (platform 36, build-tools 36) and a physical Android device with USB debugging
- JDK 17 - Android Studio's bundled JBR is used automatically by `scripts/android-jdk.mjs`
- Docker Desktop, for the local Supabase stack that runs the row-level security tests

Expo Go will not work: the app depends on native modules and needs a dev-client build.

## Setup

```bash
npm install
cp framecue.local.example.json framecue.local.json   # Supabase URL, publishable key, invite host
npm run prebuild:android                             # generates android/ and pins the Gradle JDK
npm start                                            # Metro, in its own terminal
npm run android                                      # builds, installs, launches
```

### Backend

One-time setup against the hosted Supabase project. First replace `framecue-invite.example` in
`supabase/config.toml` with your invite host.

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push                                         # migrations
cp supabase/functions/.env.example supabase/functions/.env   # LiveKit key and secret, invite secret and URL
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy                                # coach-sessions and invitation
npx supabase config push                                     # auth redirect URL and sign-in email
```

The LiveKit API key and secret live only in the function secrets; the app never sees them. Never create a
storage bucket on the project (NFR-09). Supabase's built-in email sender only delivers to the project's team
members, so configure custom SMTP before inviting other coaches.

Locally, with Docker running:

```bash
npm run db:start          # local stack, applies migrations
npm run db:test           # pgTAP row-level security tests
npm run functions:serve   # edge functions, reading supabase/functions/.env
npm run db:types          # regenerate src/backend/database.types.ts after changing a migration
```

### Invite host

Invitation and sign-in links are Android App Links on a domain you control. Serve `web/invite` over https at
the root of that domain - a `<user>.github.io` GitHub Pages site works - so that
`/.well-known/assetlinks.json` is reachable. Put the host in `framecue.local.json` as `inviteHost` and in the
function secrets as `INVITE_BASE_URL`, rebuild the app, and check that Android verified it:

```bash
adb shell pm verify-app-links --re-verify com.framecue.app
adb shell pm get-app-links com.framecue.app   # the host should show as verified
```

`assetlinks.json` carries the debug signing key's fingerprint; a release build needs its own added.

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
npm run verify    # typecheck, lint, format check, tests
npm run db:test   # row-level security tests; needs Docker and `npm run db:start`
```

Everything from M1 onward is proven on real devices as well; see the verification notes in each milestone.
