import { mediaDevices, RTCView, type MediaStream } from '@livekit/react-native-webrtc';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  clearAll,
  getStatus,
  IDLE_STATUS,
  isReplayBufferAvailable,
  prepareClip,
  probeTrack,
  startBuffering,
  stopBuffering,
  type PreparedClip,
  type ReplayBufferStatus,
  type TrackProbe,
} from '@modules/replay-buffer';
import { requestCallPermissions } from '@/call/permissions';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

/**
 * Milestone 2 spike harness. Not part of the product: it buffers this device's
 * own camera so the ring buffer, encoder, and MP4 export can be exercised
 * without a second device or a LiveKit project. The pipeline is identical for
 * a remote track - only the track handle differs - so this is also where the
 * remote-track probe is run once a real call is available.
 */
export default function DevReplayScreen() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [probe, setProbe] = useState<TrackProbe | null>(null);
  const [status, setStatus] = useState<ReplayBufferStatus>(IDLE_STATUS);
  const [clip, setClip] = useState<PreparedClip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setStatus(getStatus()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      void stopBuffering().catch(() => undefined);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const run = useCallback(async (label: string, action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
    } catch (caught) {
      setError(`${label}: ${(caught as Error).message}`);
    }
  }, []);

  const openCamera = () =>
    run('Camera', async () => {
      const permissions = await requestCallPermissions();
      if (!permissions.granted) {
        throw new Error(`missing ${permissions.missing.join(', ')}`);
      }
      const media = await mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = media as MediaStream;
      setStream(media as MediaStream);
    });

  const trackHandle = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) {
      throw new Error('open the camera first');
    }
    // Local tracks live under peer connection -1; a remote LiveKit track
    // carries its own peer connection id on the same field.
    return { peerConnectionId: -1, trackId: track.id };
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Replay buffer spike</Text>
        <Text style={styles.subtitle}>
          {isReplayBufferAvailable ? 'Native module loaded' : 'Native module NOT available'}
        </Text>

        <View style={styles.preview}>
          {stream ? (
            <RTCView streamURL={stream.toURL()} style={styles.video} objectFit="cover" />
          ) : (
            <Text style={styles.muted}>No camera yet</Text>
          )}
        </View>

        <Button label="1. Open camera" onPress={openCamera} />
        <Button
          label="2. Probe track"
          onPress={() => run('Probe', async () => setProbe(await probeTrack(trackHandle())))}
        />
        <Button
          label="3. Start buffering"
          onPress={() => run('Start', async () => void (await startBuffering(trackHandle())))}
        />
        <Button
          label="Prepare 15s"
          onPress={() => run('Prepare 15', async () => setClip(await prepareClip(15)))}
        />
        <Button
          label="Prepare 30s"
          onPress={() => run('Prepare 30', async () => setClip(await prepareClip(30)))}
        />
        <Button
          label="Stop buffering"
          onPress={() => run('Stop', async () => void (await stopBuffering()))}
        />
        <Button
          label="Clear everything"
          onPress={() =>
            run('Clear', async () => {
              await clearAll();
              setClip(null);
            })
          }
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Section title="Status">
          <Row label="Buffering" value={String(status.buffering)} />
          <Row label="Available" value={`${status.availableSeconds.toFixed(1)} s`} />
          <Row label="Samples" value={String(status.sampleCount)} />
          <Row label="Memory" value={`${(status.bytes / 1024 / 1024).toFixed(2)} MB`} />
          <Row label="Size" value={`${status.width}x${status.height}`} />
          <Row label="Encoded" value={String(status.encodedFrames)} />
          <Row label="Dropped" value={String(status.droppedFrames)} />
          {status.lastError ? <Row label="Error" value={status.lastError} /> : null}
        </Section>

        {probe ? (
          <Section title="Probe">
            <Row label="WebRTC module" value={String(probe.webrtcModuleAvailable)} />
            <Row label="Found" value={String(probe.found)} />
            <Row label="Video track" value={String(probe.isVideoTrack)} />
            <Row label="State" value={probe.state ?? '-'} />
            <Row label="Class" value={probe.nativeClass ?? '-'} />
          </Section>
        ) : null}

        {clip ? (
          <Section title="Prepared clip">
            <Row label="Requested" value={`${clip.requestedSeconds} s`} />
            <Row label="Duration" value={`${clip.durationSeconds.toFixed(2)} s`} />
            <Row label="Frames" value={String(clip.sampleCount)} />
            <Row label="Size" value={`${(clip.sizeBytes / 1024).toFixed(0)} KB`} />
            <Row label="Path" value={clip.path} />
          </Section>
        ) : null}

        <Button label="Back" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: TOUCH_TARGET,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  content: { gap: spacing.sm, padding: spacing.md },
  error: { color: colors.bad, fontSize: 14 },
  muted: { color: colors.textMuted },
  preview: {
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: radius.md,
    height: 180,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  rowLabel: { color: colors.textMuted, fontSize: 13 },
  rowValue: { color: colors.text, flexShrink: 1, fontSize: 13, textAlign: 'right' },
  screen: { backgroundColor: colors.background, flex: 1 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  video: { height: '100%', width: '100%' },
});
