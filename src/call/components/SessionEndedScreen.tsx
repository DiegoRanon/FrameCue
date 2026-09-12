import { MessageScreen } from '@/call/components/MessageScreen';

/**
 * Spec section 4: a simple confirmation. No replay, thumbnail, or file language,
 * because nothing from the session exists any more (section 4.2).
 */
export function SessionEndedScreen({
  actionLabel,
  onDone,
}: {
  actionLabel: string;
  onDone: () => void;
}) {
  return (
    <MessageScreen
      title="Session ended"
      body="The lesson is over. Nothing from this session was saved."
      primaryAction={{ label: actionLabel, onPress: onDone }}
    />
  );
}
