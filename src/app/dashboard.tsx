import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/backend/supabase';
import { SessionCard } from '@/sessions/SessionCard';
import { useCoachProfile, type CoachProfile } from '@/sessions/useCoachProfile';
import { useUpcomingSessions } from '@/sessions/useUpcomingSessions';
import { colors, radius, spacing } from '@/theme';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

/** Spec section 4 coach dashboard: upcoming sessions, Create Session, copy link, open. */
export default function Dashboard() {
  const auth = useAuth();
  const signedIn = auth.status === 'signedIn' ? auth.session : null;
  const profile = useCoachProfile(signedIn?.user.id ?? null);
  const upcoming = useUpcomingSessions();

  if (auth.status === 'signedOut') {
    return <Redirect href="/" />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={upcoming.sessions ?? []}
        keyExtractor={(session) => session.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={upcoming.refreshing}
            onRefresh={upcoming.refresh}
            tintColor={colors.text}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text accessibilityRole="header" style={styles.title}>
                Your sessions
              </Text>
              <Text style={styles.account}>{signedIn?.user.email}</Text>
            </View>
            {profile.displayName === null ? <DisplayNamePrompt profile={profile} /> : null}
            <Button
              label="Create session"
              variant="primary"
              onPress={() => router.push('/sessions/new')}
            />
            {upcoming.error ? <Text style={styles.error}>{upcoming.error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          upcoming.sessions ? (
            <Text style={styles.empty}>
              No upcoming sessions. Create one, then send the invitation link to your student.
            </Text>
          ) : null
        }
        renderItem={({ item }) => <SessionCard session={item} />}
        ItemSeparatorComponent={Separator}
        ListFooterComponent={
          <View style={styles.footer}>
            <Button label="Sign out" onPress={() => void supabase.auth.signOut()} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

/** Asked once: students see this name on the join screen and in the call. */
function DisplayNamePrompt({ profile }: { profile: CoachProfile }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setBusy(true);
    setError(null);
    profile
      .saveDisplayName(name)
      .catch(() => setError('Your name could not be saved. Try again.'))
      .finally(() => setBusy(false));
  };

  return (
    <View style={styles.prompt}>
      <TextField
        label="Your name"
        hint="Students see this when they open your invitation."
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save name" busy={busy} disabled={!name.trim()} onPress={save} />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  account: { color: colors.textMuted, fontSize: 14 },
  content: { gap: spacing.md, padding: spacing.lg },
  empty: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  error: { color: colors.warning, fontSize: 14 },
  footer: { marginTop: spacing.xl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  prompt: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  screen: { backgroundColor: colors.background, flex: 1 },
  separator: { height: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  titleRow: { gap: spacing.xs },
});
