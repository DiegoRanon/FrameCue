import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Whether the app is in the foreground.
 *
 * The replay buffer holds the student's video in memory, so it does not keep
 * running once the app leaves the foreground (FR-16). Android stops delivering
 * camera frames there anyway, which breaks the continuous window `canPrepare`
 * depends on - so a buffer that survived backgrounding would be a buffer with
 * an invisible hole in it.
 *
 * `inactive` counts as backgrounded. On Android it appears during the
 * transition; on iOS it is also the app switcher and the incoming-call banner,
 * which are exactly the moments the buffer should stop.
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  return active;
}
