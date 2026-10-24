import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { CasePacket } from '@intake/shared';
import { api } from '@/lib/api';
export function usePacket(id: string | undefined) {
  const [packet, setPacket] = useState<CasePacket | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!id) { setError('No case selected. Return home and start or reopen a case.'); setLoading(false); return; }
    setError(''); setLoading(true);
    try { setPacket(await api.case(id)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { packet, setPacket, error, setError, loading, refresh };
}
