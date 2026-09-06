import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

type ControlProps = {
  micEnabled: boolean;
  cameraEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  disabled?: boolean;
};

/**
 * Large targets, operable without looking (spec section 4.1, NFR-11).
 * Microphones stay live during replay, so this bar is unchanged in M4.
 */
export function CallControls({
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  onLeave,
  disabled = false,
}: ControlProps) {
  return (
    <View style={styles.bar}>
      <ControlButton
        label={micEnabled ? 'Mute' : 'Unmute'}
        hint={micEnabled ? 'Microphone on' : 'Microphone off'}
        active={!micEnabled}
        onPress={onToggleMic}
        disabled={disabled}
      />
      <ControlButton
        label={cameraEnabled ? 'Camera off' : 'Camera on'}
        hint={cameraEnabled ? 'Camera on' : 'Camera off'}
        active={!cameraEnabled}
        onPress={onToggleCamera}
        disabled={disabled}
      />
      <ControlButton label="Leave" hint="Leave the session" danger onPress={onLeave} />
    </View>
  );
}

function ControlButton({
  label,
  hint,
  onPress,
  active = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        active && styles.buttonActive,
        danger && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.sm,
  },
  buttonActive: { backgroundColor: colors.warning },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
