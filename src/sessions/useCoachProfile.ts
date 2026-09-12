import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/backend/supabase';
import { normalizePersonName } from '@shared/policy';

export type CoachProfile = {
  /** `undefined` while loading, `null` until the coach has chosen a name. */
  displayName: string | null | undefined;
  error: string | null;
  saveDisplayName: (name: string) => Promise<void>;
};

/**
 * The coach's own row, read and updated through RLS. The display name is what a
 * student sees on the join screen and in the call.
 */
export function useCoachProfile(coachId: string | null): CoachProfile {
  const [displayName, setDisplayName] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coachId) {
      return;
    }
    let cancelled = false;
    void supabase
      .from('coaches')
      .select('display_name')
      .eq('id', coachId)
      .single()
      .then(({ data, error: queryError }) => {
        if (cancelled) {
          return;
        }
        if (queryError) {
          setError('Your profile could not be loaded.');
          return;
        }
        setDisplayName(data.display_name);
      });
    return () => {
      cancelled = true;
    };
  }, [coachId]);

  const saveDisplayName = useCallback(
    async (name: string) => {
      if (!coachId) {
        return;
      }
      const normalized = normalizePersonName(name);
      const { error: updateError } = await supabase
        .from('coaches')
        .update({ display_name: normalized })
        .eq('id', coachId);
      if (updateError) {
        throw updateError;
      }
      setDisplayName(normalized);
    },
    [coachId],
  );

  return { displayName, error, saveDisplayName };
}
