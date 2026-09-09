import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CALL_ROLES, roleLabel, type CallRole } from '@/call/roles';
import { env, isLivekitConfigured } from '@/config/env';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

/**
 * Development entry point. Roles are chosen by hand because there is no
 * backend yet: from M6 the coach arrives from their dashboard and the student
 * from an invitation deep link (FR-02, FR-03).
 */
export default function Home() {
  const configured = isLivekitConfigured();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>FrameCue</Text>
          <Text style={styles.subtitle}>Choose a role for this device</Text>
        </View>

        <View style={styles.roles}>
          {CALL_ROLES.map((role) => (
            <RoleButton key={role} role={role} disabled={!configured} />
          ))}
        </View>

        <View style={styles.status}>
          <Text style={styles.statusText}>
            {configured ? `Room: ${env.livekitRoom}` : 'LiveKit is not configured'}
          </Text>
          {configured ? null : (
            <Text style={styles.statusHint}>
              Copy framecue.local.example.json to framecue.local.json, add your LiveKit URL and one
              token per role, then rebuild.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RoleButton({ role, disabled }: { role: CallRole; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Join as ${roleLabel[role]}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => router.push({ pathname: '/call', params: { role } })}
      style={({ pressed }) => [
        styles.roleButton,
        disabled && styles.roleButtonDisabled,
        pressed && styles.roleButtonPressed,
      ]}
    >
      <Text style={styles.roleLabel}>Join as {roleLabel[role]}</Text>
      <Text style={styles.roleHint}>
        {role === 'coach' ? 'Sees the student and controls replay' : 'Performs and sees the coach'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: spacing.xl, justifyContent: 'center', padding: spacing.lg },
  devLink: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
  },
  devLinkText: { color: colors.textMuted, fontSize: 14 },
  header: { alignItems: 'center', gap: spacing.xs },
  roleButton: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET + 16,
    padding: spacing.md,
  },
  roleButtonDisabled: { opacity: 0.5 },
  roleButtonPressed: { opacity: 0.8 },
  roleHint: { color: colors.textMuted, fontSize: 13 },
  roleLabel: { color: colors.text, fontSize: 18, fontWeight: '600' },
  roles: { gap: spacing.sm },
  screen: { backgroundColor: colors.background, flex: 1 },
  status: { alignItems: 'center', gap: spacing.xs },
  statusHint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  statusText: { color: colors.textMuted, fontSize: 14 },
  subtitle: { color: colors.textMuted, fontSize: 16 },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
});
