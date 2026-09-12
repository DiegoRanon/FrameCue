import { Pressable, StyleSheet, Text, View } from 'react-native';

import { REPLAY_NOTICE, REPLAY_NOTICE_TITLE } from '@/precall/consent';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

/** The section 8.2 notice with the acknowledgement FR-04 requires before joining. */
export function ConsentNotice({
  accepted,
  onChange,
}: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{REPLAY_NOTICE_TITLE}</Text>
      <Text style={styles.body}>{REPLAY_NOTICE}</Text>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="I understand how the temporary replay works"
        accessibilityState={{ checked: accepted }}
        onPress={() => onChange(!accepted)}
        style={styles.row}
      >
        <View style={[styles.box, accepted && styles.boxChecked]}>
          {accepted ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <Text style={styles.rowLabel}>I understand</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  box: {
    alignItems: 'center',
    borderColor: colors.textMuted,
    borderRadius: 6,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: TOUCH_TARGET },
  rowLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  tick: { color: colors.text, fontSize: 18, fontWeight: '700' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
