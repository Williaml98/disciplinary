import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCasesPage, type CaseQuery } from './api';
import { toMessage } from './toast';
import type { DisciplinaryCase } from '../app/components/mockData';

export interface PagedCases {
  items: DisciplinaryCase[];
  page: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  loading: boolean;
  error: string;

  setPage: (page: number) => void;
  /** Append mode: fetch the next page and concatenate, for "Load more" lists. */
  loadMore: () => void;
  /** Re-fetch the current page, keeping the user's position. */
  reload: () => void;
  /** Swap one case in place after a mutation, without a round trip. */
  replaceItem: (updated: DisciplinaryCase) => void;
}

interface Options {
  size?: number;
  sort?: string;
  mode?: 'replace' | 'append';
  /** Skip fetching entirely — e.g. while the view that needs the data isn't mounted. */
  enabled?: boolean;
}

/**
 * Paginated case list with server-side filtering.
 *
 * Replaces the previous model where App.tsx loaded every case once and passed the whole array to every
 * dashboard. There's no react-query here and adding it would be overkill: this needs fetch-on-change,
 * loading/error state, race protection and manual invalidation — about eighty lines — where the library
 * would bring a cross-component cache and background revalidation the app has no use for.
 */
export function usePagedCases(filters: CaseQuery, options: Options = {}): PagedCases {
  const { size = 20, sort, mode = 'replace', enabled = true } = options;

  const [items, setItems] = useState<DisciplinaryCase[]>([]);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [first, setFirst] = useState(true);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  // Depend on a derived string rather than the filters object: `filters` is a fresh object literal on
  // every render, so a dependency on it would re-fetch forever.
  const filterKey = JSON.stringify(filters);
  const queryKey = `${filterKey}|${page}|${size}|${sort ?? ''}|${reloadToken}`;

  // Changing a filter must reset to page 0 — otherwise narrowing the results while on page 3 lands on
  // a page that no longer exists, showing an empty list.
  const lastFilterKey = useRef(filterKey);
  if (lastFilterKey.current !== filterKey) {
    lastFilterKey.current = filterKey;
    if (page !== 0) setPage(0);
  }

  // Guards against out-of-order responses: typing in a search box fires overlapping requests, and a
  // slow earlier one landing after a fast later one would show the wrong results with no error.
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError('');

    fetchCasesPage({ ...filters, page, size, sort })
      .then(result => {
        if (id !== requestId.current) return;
        setItems(prev => (mode === 'append' && page > 0 ? [...prev, ...result.content] : result.content));
        setTotalElements(result.totalElements);
        setTotalPages(result.totalPages);
        setFirst(result.first);
        setLast(result.last);
      })
      .catch(err => {
        if (id !== requestId.current) return;
        setError(toMessage(err, 'Unable to load cases.'));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // filters is intentionally excluded — queryKey already encodes it. See filterKey above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, enabled]);

  const reload = useCallback(() => setReloadToken(t => t + 1), []);

  const loadMore = useCallback(() => {
    setPage(current => (current + 1 < totalPages ? current + 1 : current));
  }, [totalPages]);

  const replaceItem = useCallback((updated: DisciplinaryCase) => {
    setItems(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  }, []);

  // Deleting the last row on the final page would otherwise strand the user on an empty page.
  useEffect(() => {
    if (!loading && items.length === 0 && page > 0 && totalElements > 0) {
      setPage(p => Math.max(0, Math.min(p - 1, totalPages - 1)));
    }
  }, [loading, items.length, page, totalElements, totalPages]);

  return {
    items, page, totalElements, totalPages, first, last, loading, error,
    setPage, loadMore, reload, replaceItem,
  };
}
