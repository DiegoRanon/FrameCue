import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger';

/** A large, labelled touch target (NFR-11). */
export function Button({
  label,
  onPress,
  hint,
  variant = 'secondary',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  hint?: string;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
}) {
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
  },
  danger: { backgroundColor: colors.danger },
  inactive: { opacity: 0.5 },
  label: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.8 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceRaised },
});
