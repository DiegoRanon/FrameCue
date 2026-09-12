import { Share } from 'react-native';

/**
 * Opens the system share sheet with the invitation link. Only the link is
 * shared - never media (spec section 4.2).
 */
export async function shareInvite(title: string, inviteUrl: string): Promise<void> {
  await Share.share({
    message: `You're invited to a FrameCue lesson: ${title}\nOpen this link on your phone to join: ${inviteUrl}`,
  });
}
