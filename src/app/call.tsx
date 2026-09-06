import { router, useLocalSearchParams } from 'expo-router';

import { CallScreen } from '@/call/CallScreen';
import { MessageScreen } from '@/call/components/MessageScreen';
import { parseRole } from '@/call/roles';

export default function CallRoute() {
  const { role: rawRole } = useLocalSearchParams<{ role?: string }>();
  const role = parseRole(rawRole);

  const goHome = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (!role) {
    return (
      <MessageScreen
        title="Unknown role"
        body="This session can only be joined as a coach or a student."
        primaryAction={{ label: 'Back', onPress: goHome }}
      />
    );
  }

  return <CallScreen role={role} onExit={goHome} />;
}
