import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExpoConfig } from 'expo/config';

type LocalConfig = {
  livekitUrl?: string;
  livekitRoom?: string;
  coachToken?: string;
  studentToken?: string;
};

/**
 * Local development configuration, git-ignored. A JSON file rather than a .env
 * because Expo's dotenv loader calls node:util.parseEnv, which only exists on
 * Node 20.12+/21.7+; on older runtimes the presence of any .env file crashes
 * the CLI before this config is even read. Environment variables still win
 * when set, which is what EAS and CI will use.
 */
function readLocalConfig(): LocalConfig {
  // Resolved against this file, not the working directory: the dev server does
  // not always evaluate the config from the project root.
  const root = typeof __dirname === 'string' ? __dirname : process.cwd();
  const path = join(root, 'framecue.local.json');
  if (!existsSync(path)) {
    console.warn(`[framecue] No local config at ${path}; LiveKit values will be empty.`);
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as LocalConfig;
  } catch (error) {
    throw new Error(`framecue.local.json is not valid JSON: ${(error as Error).message}`);
  }
}

const local = readLocalConfig();

/**
 * Values come from a git-ignored .env (see .env.example). Expo CLI loads .env
 * into process.env before this file is evaluated.
 *
 * Nothing secret belongs here long term: from M6 the backend mints LiveKit
 * tokens per participant and the dev token is dropped.
 */
const config: ExpoConfig = {
  name: 'FrameCue',
  slug: 'framecue',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'framecue',
  userInterfaceStyle: 'dark',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.framecue.app',
    supportsTablet: true,
  },
  android: {
    package: 'com.framecue.app',
    adaptiveIcon: {
      backgroundColor: '#0B0F14',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    // Wires the LiveKit fork of react-native-webrtc into the native projects
    // and adds the camera/microphone permissions the live call needs.
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    livekitUrl: process.env.LIVEKIT_URL ?? local.livekitUrl,
    livekitRoom: process.env.LIVEKIT_ROOM ?? local.livekitRoom,
    livekitCoachToken: process.env.LIVEKIT_COACH_TOKEN ?? local.coachToken,
    livekitStudentToken: process.env.LIVEKIT_STUDENT_TOKEN ?? local.studentToken,
  },
};

export default config;
