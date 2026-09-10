import type { PreparedClip } from '@modules/replay-buffer';
import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import type { Room } from 'livekit-client';

import { REPLAY_CLIP_TOPIC } from '@/control/replayControl';
import type { ReplayDuration } from '@/replay/pendingReplay';

/**
 * Moving a prepared replay from the coach's device to the student's, over a
 * LiveKit byte stream (D-001).
 *
 * This happens while the replay sits pending, not when the coach presses Show,
 * which is what makes Show effectively instant (NFR-01). Nothing here touches
 * the live tracks: the transfer shares the peer connection's data channel, and
 * LiveKit chunks it so a 5 MB clip cannot block a control message.
 *
 * The received file is a cache-directory temporary, deleted the moment review
 * ends (FR-16). It is never copied anywhere a user or another app can reach.
 */

/** Read size per disk hit. LiveKit re-splits to its own 15 KB wire chunks. */
const READ_CHUNK_BYTES = 64 * 1024;

/** Cache subdirectory for clips received from the coach. Wiped on app start. */
const INCOMING_DIRECTORY = 'framecue-incoming-replay';

export type ReceivedClip = {
  clipId: string;
  requestedSeconds: ReplayDuration;
  /** file:// URI of the local copy, ready for the player. */
  uri: string;
};

function incomingDirectory(): Directory {
  const directory = new Directory(Paths.cache, INCOMING_DIRECTORY);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function parseRequestedSeconds(value: string | undefined): ReplayDuration {
  return value === '30' ? 30 : 15;
}

/**
 * Streams the prepared MP4 to the given participants.
 *
 * Reads the file a chunk at a time rather than loading it whole: a 30 s clip is
 * around 6 MB, and the buffer that produced it is already the app's memory
 * ceiling (NFR-05).
 */
export async function sendClip(
  room: Room,
  params: {
    clipId: string;
    clip: PreparedClip;
    requestedSeconds: ReplayDuration;
    destinationIdentities: string[];
  },
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  const file = new File(params.clip.uri);
  if (!file.exists) {
    throw new Error('The prepared replay is no longer available.');
  }

  const totalSize = file.size;
  const writer = await room.localParticipant.streamBytes({
    topic: REPLAY_CLIP_TOPIC,
    name: params.clipId,
    mimeType: 'video/mp4',
    totalSize,
    destinationIdentities: params.destinationIdentities,
    attributes: {
      clipId: params.clipId,
      requestedSeconds: String(params.requestedSeconds),
    },
  });

  const handle = file.open(FileMode.ReadOnly);
  let sent = 0;
  try {
    // Bounded by the size announced to the receiver rather than by reading
    // until end-of-file, so the two can never disagree about how long the
    // stream is.
    while (sent < totalSize) {
      // Not `signal.throwIfAborted()`: React Native's AbortSignal does not
      // implement it. Throwing rather than returning matters - it leaves the
      // stream short of `totalSize`, so the receiver rejects the partial file
      // instead of treating it as a clip.
      if (options.signal?.aborted) {
        throw new Error('The replay transfer was cancelled.');
      }
      const chunk = handle.readBytes(Math.min(READ_CHUNK_BYTES, totalSize - sent));
      if (chunk.byteLength === 0) {
        throw new Error('The prepared replay could not be read.');
      }
      await writer.write(chunk);
      sent += chunk.byteLength;
      options.onProgress?.(totalSize > 0 ? Math.min(sent / totalSize, 1) : 0);
    }
  } finally {
    handle.close();
    // Closing is what tells the receiver the stream is complete. On an abort
    // the byte count will not match and the student's reader rejects, which is
    // the outcome we want - a truncated MP4 must never be treated as a clip.
    await writer.close().catch(() => undefined);
  }
}

export type ClipReceiverHandlers = {
  onStarted: (clipId: string, requestedSeconds: ReplayDuration) => void;
  onProgress: (clipId: string, fraction: number) => void;
  onReceived: (clip: ReceivedClip) => void;
  onFailed: (clipId: string, message: string) => void;
};

/**
 * Accepts incoming clips on the student's device, writing each to its own cache
 * file. Returns the unsubscribe function.
 *
 * Bytes are written as they arrive rather than collected first, so peak memory
 * stays at one chunk regardless of clip length.
 */
export function receiveClips(room: Room, handlers: ClipReceiverHandlers): () => void {
  // The sender is not inspected: the room is strictly one-to-one, so the only
  // participant who can open a stream here is the coach.
  room.registerByteStreamHandler(REPLAY_CLIP_TOPIC, (reader) => {
    void (async () => {
      const clipId = reader.info.name || reader.info.attributes?.clipId || reader.info.id;
      const requestedSeconds = parseRequestedSeconds(reader.info.attributes?.requestedSeconds);

      handlers.onStarted(clipId, requestedSeconds);
      reader.onProgress = (fraction) => handlers.onProgress(clipId, fraction ?? 0);

      // Everything from here can throw - a full disk, a truncated stream, a
      // cache directory the system reclaimed mid-transfer - and none of it may
      // reach the call (NFR-04).
      let file: File | null = null;
      let handle: FileHandle | null = null;
      try {
        file = new File(incomingDirectory(), `${clipId}.mp4`);
        file.create({ overwrite: true, intermediates: true });
        handle = file.open(FileMode.ReadWrite);

        for await (const chunk of reader) {
          handle.writeBytes(chunk);
        }

        handle.close();
        handle = null;
        handlers.onReceived({ clipId, requestedSeconds, uri: file.uri });
      } catch (caught) {
        handle?.close();
        if (file) {
          // A partial MP4 is worse than none: it would play as a broken clip.
          deleteClipFile(file.uri);
        }
        handlers.onFailed(
          clipId,
          caught instanceof Error ? caught.message : 'The replay could not be received.',
        );
      }
    })();
  });

  return () => room.unregisterByteStreamHandler(REPLAY_CLIP_TOPIC);
}

/** Best-effort delete; a clip that is already gone is the desired state. */
export function deleteClipFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Nothing to do - the file is unreachable, which is what we wanted.
  }
}

/**
 * Removes every received clip. Called when review ends and again when the call
 * screen mounts, so a clip left behind by a crash cannot outlive its session
 * (FR-16, AC-12).
 */
export function clearReceivedClips(): void {
  try {
    const directory = new Directory(Paths.cache, INCOMING_DIRECTORY);
    if (directory.exists) {
      directory.delete();
    }
  } catch {
    // Same reasoning as deleteClipFile.
  }
}
