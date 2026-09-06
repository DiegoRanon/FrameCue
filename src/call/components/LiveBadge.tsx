import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

/**
 * Spec section 4.1: a visible LIVE label distinguishes live from replay. From
 * M4 the same slot carries REVIEWING LAST 15/30 SECONDS, so the label is a
 * prop rather than a constant.
 */
export function LiveBadge({ label = 'LIVE' }: { label?: string }) {
  const isLive = label === 'LIVE';
  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel={`Mode: ${label}`}>
      {isLive ? <View style={styles.dot} /> : null}
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 20, 0.75)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  dot: { backgroundColor: colors.live, borderRadius: radius.pill, height: 8, width: 8 },
  text: { color: colors.text, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
