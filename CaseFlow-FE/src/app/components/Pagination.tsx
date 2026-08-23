import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  totalElements: number;
  first: boolean;
  last: boolean;
  onPageChange: (page: number) => void;
  /** Singular noun for the summary line, e.g. "case" / "account". */
  label?: string;
  /** Plural form, when adding "s" is wrong ("entry" -> "entries"). */
  labelPlural?: string;
}

/**
 * Numbered page controls for the table views.
 *
 * `page` is 0-based on the wire (matching Spring and array indexing) and displayed 1-based, so the
 * conversion happens here in one place rather than at each call site.
 */
export function Pagination({
  page, totalPages, totalElements, first, last, onPageChange, label = 'item', labelPlural,
}: Props) {
  const noun = totalElements === 1 ? label : (labelPlural ?? `${label}s`);

  if (totalPages <= 1) {
    return (
      <div className="px-6 py-3 text-[11px] font-tight font-medium text-ink-400 border-t border-[var(--hairline)] tabular">
        {totalElements} {noun}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-[var(--hairline)]">
      <p className="text-[11px] font-tight font-medium text-ink-400 tabular">
        Page {page + 1} of {totalPages} · {totalElements} {noun}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={first}
          aria-label="Previous page"
          className="flex items-center gap-1 pl-1.5 pr-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--hairline)] text-ink-600 bg-white
                     hover:bg-ink-50 hover:border-[var(--hairline-strong)] hover:text-ink-900
                     disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-ink-600 disabled:cursor-not-allowed
                     transition-all duration-[var(--dur)] ease-[var(--ease-out)]"
        >
          <ChevronLeft size={13} /> Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={last}
          aria-label="Next page"
          className="flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--hairline)] text-ink-600 bg-white
                     hover:bg-ink-50 hover:border-[var(--hairline-strong)] hover:text-ink-900
                     disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-ink-600 disabled:cursor-not-allowed
                     transition-all duration-[var(--dur)] ease-[var(--ease-out)]"
        >
          Next <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

/** Append-style control for narrow panels where numbered pages don't fit. */
export function LoadMore({ loaded, total, loading, onLoadMore }: {
  loaded: number;
  total: number;
  loading: boolean;
  onLoadMore: () => void;
}) {
  if (loaded >= total) {
    return total === 0 ? null : (
      <p className="px-4 py-3 text-center text-[11px] font-tight text-ink-400">All {total} shown</p>
    );
  }
  return (
    <button
      onClick={onLoadMore}
      disabled={loading}
      className="w-full px-4 py-3 text-[12px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50
                 transition-colors duration-[var(--dur)] ease-[var(--ease-out)] border-t border-[var(--hairline)]"
    >
      {loading ? 'Loading…' : `Load more (${loaded} of ${total})`}
    </button>
  );
}
