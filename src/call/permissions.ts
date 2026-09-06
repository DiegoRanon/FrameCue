import { PermissionsAndroid, Platform } from 'react-native';

export type CallPermissions = {
  granted: boolean;
  /** Human-readable names of what is still missing, for the retry screen. */
  missing: string[];
};

const ANDROID_PERMISSIONS = [
  { permission: PermissionsAndroid.PERMISSIONS.CAMERA, label: 'Camera' },
  { permission: PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, label: 'Microphone' },
] as const;

/**
 * Camera and microphone must be granted before joining (FR-05). iOS asks at
 * the point of capture via the usage strings, so there is nothing to request
 * up front there; that path is exercised when iOS lands in M8.
 */
export async function requestCallPermissions(): Promise<CallPermissions> {
  if (Platform.OS !== 'android') {
    return { granted: true, missing: [] };
  }

  const results = await PermissionsAndroid.requestMultiple(
    ANDROID_PERMISSIONS.map((entry) => entry.permission),
  );

  const missing = ANDROID_PERMISSIONS.filter(
    (entry) => results[entry.permission] !== PermissionsAndroid.RESULTS.GRANTED,
  ).map((entry) => entry.label);

  return { granted: missing.length === 0, missing };
}
