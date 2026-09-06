import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

export type MessageAction = { label: string; onPress: () => void };

/** Shared surface for the states that are not a live call: setup problems,
 *  denied permissions, connection failures. */
export function MessageScreen({
  title,
  body,
  details,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  body: string;
  details?: string[];
  primaryAction?: MessageAction;
  secondaryAction?: MessageAction;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {details?.length ? (
          <View style={styles.details}>
            {details.map((detail) => (
              <Text key={detail} style={styles.detail}>
                {detail}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.actions}>
          {primaryAction ? <Button action={primaryAction} primary /> : null}
          {secondaryAction ? <Button action={secondaryAction} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Button({ action, primary = false }: { action: MessageAction; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{action.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.lg, width: '100%' },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: { opacity: 0.8 },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  detail: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 13 },
  details: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.md,
    width: '100%',
  },
  screen: { backgroundColor: colors.background, flex: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center' },
});
