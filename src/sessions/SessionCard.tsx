import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { coachSessions, describeApiError } from '@/backend/api';
import { describeSchedule } from '@/sessions/schedule';
import { shareInvite } from '@/sessions/shareInvite';
import type { SessionSummary } from '@shared/contract';
import { colors, radius, spacing } from '@/theme';
import { Button } from '@/ui/Button';

type Action = 'copy' | 'share';

/** One upcoming session on the dashboard: copy or share its link, or start it. */
export function SessionCard({ session }: { session: SessionSummary }) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The link is derived again by the backend each time rather than kept on the
  // phone, so it is the same link the student already has (D-025).
  const withInviteUrl = (action: Action, use: (inviteUrl: string) => Promise<string | null>) => {
    setBusy(action);
    setNotice(null);
    coachSessions
      .inviteLink(session.id)
      .then(({ inviteUrl }) => use(inviteUrl))
      .then((message) => setNotice(message))
      .catch((caught: unknown) => setNotice(describeApiError(caught)))
      .finally(() => setBusy(null));
  };

  const copy = () =>
    withInviteUrl('copy', async (inviteUrl) => {
      await Clipboard.setStringAsync(inviteUrl);
      return 'Invitation link copied.';
    });

  const share = () =>
    withInviteUrl('share', async (inviteUrl) => {
      await shareInvite(session.title, inviteUrl);
      return null;
    });

  const start = () => router.push({ pathname: '/sessions/[id]', params: { id: session.id } });

  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>{session.title}</Text>
        <Text style={styles.meta}>
          {describeSchedule(new Date(session.scheduledAt), session.durationMinutes)}
        </Text>
        {session.studentName ? <Text style={styles.meta}>With {session.studentName}</Text> : null}
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label="Copy link"
            busy={busy === 'copy'}
            disabled={busy !== null}
            onPress={copy}
          />
        </View>
        <View style={styles.action}>
          <Button label="Share" busy={busy === 'share'} disabled={busy !== null} onPress={share} />
        </View>
      </View>
      <Button label="Start session" variant="primary" onPress={start} />
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  meta: { color: colors.textMuted, fontSize: 14 },
  notice: { color: colors.text, fontSize: 14 },
  text: { gap: 2 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
