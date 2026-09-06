/**
 * Build, install, and launch the debug app on a connected Android device.
 *
 * Replaces `expo run:android` on this machine. Expo's runner calls
 * `adb -s <id> emu avd name` on every device adb reports, in a Promise.all.
 * Unrelated Windows services that listen on a port in adb's emulator scan
 * range (5555-5585) make adb invent a phantom, permanently offline emulator,
 * and that one failing call aborts the whole run. This script targets an
 * online device directly and never queries the phantom.
 *
 * Flags:
 *   --no-build          install the existing APK without running Gradle
 *   --device <adb-id>   target a specific device (or set FRAMECUE_ANDROID_DEVICE)
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { connect } from 'node:net';

const ADB = join(process.env.ANDROID_HOME ?? '', 'platform-tools', 'adb');
const APK = join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const PACKAGE = 'com.framecue.app';
const METRO_PORT = 8081;

const args = process.argv.slice(2);
const run = (cmd, cmdArgs, opts = {}) =>
  execFileSync(cmd, cmdArgs, { stdio: 'pipe', encoding: 'utf8', ...opts });

function onlineDevices() {
  return run(ADB, ['devices'])
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([id, state]) => id && state === 'device')
    .map(([id]) => id);
}

function pickDevice() {
  const requested =
    args[args.indexOf('--device') + 1] || process.env.FRAMECUE_ANDROID_DEVICE || null;
  const online = onlineDevices();
  if (requested && args.includes('--device')) {
    if (!online.includes(requested)) {
      throw new Error(`Device ${requested} is not online. Online: ${online.join(', ') || 'none'}`);
    }
    return requested;
  }
  if (online.length === 0) {
    throw new Error('No online Android device. Start an emulator or connect a phone.');
  }
  if (online.length > 1) {
    console.log(`[android-run] Multiple devices online, using ${online[0]}. Override --device.`);
  }
  return online[0];
}

const metroReachable = () =>
  new Promise((resolve) => {
    const socket = connect({ port: METRO_PORT, host: '127.0.0.1' })
      .on('connect', () => (socket.end(), resolve(true)))
      .on('error', () => resolve(false));
  });

const device = pickDevice();
console.log(`[android-run] Target: ${device}`);

if (!args.includes('--no-build')) {
  run('node', ['scripts/android-jdk.mjs'], { stdio: 'inherit' });
  console.log('[android-run] Building debug APK...');
  // Absolute path: cmd.exe does not resolve a bare script name from cwd, and
  // Node requires shell:true to spawn a .bat at all.
  const gradlew = join(
    process.cwd(),
    'android',
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
  );
  run(`"${gradlew}"`, ['assembleDebug'], { cwd: 'android', stdio: 'inherit', shell: true });
}

if (!existsSync(APK)) {
  throw new Error(`No APK at ${APK}. Run without --no-build first.`);
}

console.log('[android-run] Installing...');
run(ADB, ['-s', device, 'install', '-r', APK], { stdio: 'inherit' });
run(ADB, ['-s', device, 'reverse', `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`]);
run(ADB, ['-s', device, 'shell', 'am', 'start', '-n', `${PACKAGE}/.MainActivity`], {
  stdio: 'inherit',
});

if (!(await metroReachable())) {
  console.log(`\n[android-run] Metro is not running on ${METRO_PORT}. Start it with: npm start`);
}
