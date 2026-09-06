import { StyleSheet, Text, View } from 'react-native';

import type { ConnectionStatus } from '@/call/connectionStatus';
import { colors, radius, spacing } from '@/theme';

const toneColor = {
  good: colors.good,
  warning: colors.warning,
  bad: colors.bad,
} as const;

/** FR-18: understandable connection feedback, no technical jargon. */
export function ConnectionPill({ status }: { status: ConnectionStatus }) {
  return (
    <View style={styles.pill} accessibilityRole="text" accessibilityLabel={status.label}>
      <View style={[styles.dot, { backgroundColor: toneColor[status.tone] }]} />
      <Text style={styles.text}>{status.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { borderRadius: radius.pill, height: 8, width: 8 },
  pill: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 20, 0.75)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  text: { color: colors.text, fontSize: 12, fontWeight: '600' },
});
