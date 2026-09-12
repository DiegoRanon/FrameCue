import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ExpoConfig } from 'expo/config';

type LocalConfig = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  inviteHost?: string;
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
    console.warn(`[framecue] No local config at ${path}; backend values will be empty.`);
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as LocalConfig;
  } catch (error) {
    throw new Error(`framecue.local.json is not valid JSON: ${(error as Error).message}`);
  }
}

const local = readLocalConfig();

const inviteHost = process.env.FRAMECUE_INVITE_HOST ?? local.inviteHost;

/**
 * Nothing secret belongs here. The Supabase publishable key only identifies the
 * project - RLS and the edge functions decide what it can do - and LiveKit
 * credentials are no longer configured at all: the backend issues them per
 * participant, per session (M6).
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
    // Invitation and sign-in links are https App Links on the invite host,
    // verified against web/invite/.well-known/assetlinks.json, so tapping one in
    // any messenger or mail app opens FrameCue directly (FR-02, FR-03).
    intentFilters: inviteHost
      ? [
          {
            action: 'VIEW',
            autoVerify: true,
            category: ['BROWSABLE', 'DEFAULT'],
            data: [
              { scheme: 'https', host: inviteHost, pathPrefix: '/join/' },
              { scheme: 'https', host: inviteHost, pathPrefix: '/auth/' },
            ],
          },
        ]
      : undefined,
  },
  plugins: [
    'expo-router',
    // Wires the LiveKit fork of react-native-webrtc into the native projects
    // and adds the camera/microphone permissions the live call needs.
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
    '@react-native-community/datetimepicker',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.FRAMECUE_SUPABASE_URL ?? local.supabaseUrl,
    supabasePublishableKey:
      process.env.FRAMECUE_SUPABASE_PUBLISHABLE_KEY ?? local.supabasePublishableKey,
    inviteHost,
  },
};

export default config;
