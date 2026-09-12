import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { coachSessions, describeApiError } from '@/backend/api';
import { defaultStartTime, describeSchedule, withDate, withTime } from '@/sessions/schedule';
import { isJoinable } from '@/sessions/sessionRows';
import { shareInvite } from '@/sessions/shareInvite';
import {
  normalizePersonName,
  SESSION_DURATIONS,
  TITLE_MAX_LENGTH,
  type SessionDuration,
} from '@shared/policy';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';

type Created = { title: string; inviteUrl: string; copied: boolean };

/**
 * Spec section 4 Create Session. Defaults are chosen so a coach can create a
 * session and have the link copied in under a minute (AC-01): the start time is
 * the next half hour, and creating copies the link straight away.
 */
export default function NewSession() {
  const auth = useAuth();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(() => defaultStartTime(new Date()));
  const [duration, setDuration] = useState<SessionDuration>(60);
  const [studentName, setStudentName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  if (auth.status === 'signedOut') {
    return <Redirect href="/" />;
  }

  const pickOnAndroid = (mode: 'date' | 'time') => {
    DateTimePickerAndroid.open({
      value: startsAt,
      mode,
      minimumDate: mode === 'date' ? new Date() : undefined,
      onChange: (event, picked) => {
        if (event.type !== 'set' || !picked) {
          return;
        }
        setStartsAt((current) =>
          mode === 'date' ? withDate(current, picked) : withTime(current, picked),
        );
      },
    });
  };

  const create = () => {
    const summary = {
      id: '00000000-0000-0000-0000-000000000000',
      title,
      studentName: null,
      scheduledAt: startsAt.toISOString(),
      durationMinutes: duration,
      status: 'scheduled' as const,
    };
    if (!isJoinable(summary, new Date())) {
      setError('That time has already passed. Choose a later start.');
      return;
    }

    setBusy(true);
    setError(null);
    const name = normalizePersonName(studentName);
    coachSessions
      .create({
        title: title.trim(),
        scheduledAt: startsAt.toISOString(),
        durationMinutes: duration,
        studentName: name || undefined,
      })
      .then(async (result) => {
        const copied = await Clipboard.setStringAsync(result.inviteUrl).catch(() => false);
        setCreated({ title: result.session.title, inviteUrl: result.inviteUrl, copied });
      })
      .catch((caught: unknown) => setError(describeApiError(caught)))
      .finally(() => setBusy(false));
  };

  if (created) {
    return (
      <Screen
        title="Session created"
        subtitle={
          created.copied
            ? 'The invitation link is copied. Paste it into a message to your student.'
            : 'Send this invitation link to your student.'
        }
      >
        <View style={styles.linkBox}>
          <Text selectable style={styles.link}>
            {created.inviteUrl}
          </Text>
        </View>
        <Button
          label="Share link"
          variant="primary"
          onPress={() => void shareInvite(created.title, created.inviteUrl)}
        />
        {created.copied ? null : (
          <Button
            label="Copy link"
            onPress={() =>
              void Clipboard.setStringAsync(created.inviteUrl).then(() =>
                setCreated({ ...created, copied: true }),
              )
            }
          />
        )}
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen title="Create session">
      <TextField
        label="Title"
        placeholder="e.g. Footwork drills"
        value={title}
        onChangeText={setTitle}
        maxLength={TITLE_MAX_LENGTH}
        autoCapitalize="sentences"
        autoFocus
      />

      <View style={styles.field}>
        <Text style={styles.label}>Starts</Text>
        <Text style={styles.value}>{describeSchedule(startsAt, duration)}</Text>
        {Platform.OS === 'android' ? (
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Button label="Change date" onPress={() => pickOnAndroid('date')} />
            </View>
            <View style={styles.rowItem}>
              <Button label="Change time" onPress={() => pickOnAndroid('time')} />
            </View>
          </View>
        ) : (
          <DateTimePicker
            value={startsAt}
            mode="datetime"
            minimumDate={new Date()}
            onChange={(_event, picked) => (picked ? setStartsAt(picked) : undefined)}
          />
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Length</Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {SESSION_DURATIONS.map((minutes) => (
            <Pressable
              key={minutes}
              accessibilityRole="radio"
              accessibilityLabel={`${minutes} minutes`}
              accessibilityState={{ checked: duration === minutes }}
              onPress={() => setDuration(minutes)}
              style={[styles.chip, duration === minutes && styles.chipSelected]}
            >
              <Text style={styles.chipText}>{minutes} min</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <TextField
        label="Student name (optional)"
        value={studentName}
        onChangeText={setStudentName}
        maxLength={60}
        autoCapitalize="words"
      />

      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Button
        label="Create and copy link"
        variant="primary"
        busy={busy}
        disabled={!title.trim()}
        onPress={create}
      />
      <Button label="Cancel" disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
  },
  chipSelected: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  error: { color: colors.warning, fontSize: 15 },
  field: { gap: spacing.sm },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  link: { color: colors.text, fontSize: 15 },
  linkBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowItem: { flex: 1 },
  value: { color: colors.text, fontSize: 17 },
});
