import { useCallback, useEffect, useState } from 'react';
import { fetchCaseStats, fetchMonthlyCaseCounts, fetchUserStats } from './api';
import { toMessage } from './toast';
import type { CaseStats, MonthlyCaseCount, UserStats } from '../app/components/mockData';

/**
 * Delays a rapidly-changing value (a search box) so it can drive a server query without firing a
 * request per keystroke. Debouncing lives here rather than inside the data hooks, which stay dumb.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

interface Loadable<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
}

function useLoadable<T>(load: () => Promise<T>, fallbackMessage: string, enabled = true): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    load()
      .then(result => active && setData(result))
      .catch(err => active && setError(toMessage(err, fallbackMessage)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // `load` is a fresh closure each render; `token` is what deliberately re-runs this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enabled]);

  return { data, loading, error, reload: useCallback(() => setToken(t => t + 1), []) };
}

/**
 * Global case counts for badges and stat tiles.
 *
 * These must not be derived from a page of results: after pagination, counting the loaded array would
 * silently describe only the current page. An under-counted registration-hold badge, for instance,
 * would let a suspended student slip through registration with nothing to indicate anything was wrong.
 */
export function useCaseStats(enabled = true): Loadable<CaseStats> {
  return useLoadable(fetchCaseStats, 'Unable to load case statistics.', enabled);
}

export function useUserStats(enabled = true): Loadable<UserStats> {
  return useLoadable(fetchUserStats, 'Unable to load user statistics.', enabled);
}

export function useMonthlyCaseCounts(enabled = true): Loadable<MonthlyCaseCount[]> {
  return useLoadable(fetchMonthlyCaseCounts, 'Unable to load monthly case counts.', enabled);
}
