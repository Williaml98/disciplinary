import { ChevronLeft, ChevronRight } from 'lucide-react';

const NAVY = '#1D3A5F';

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
      <div className="px-6 py-3 text-xs text-gray-500 border-t border-gray-100">
        {totalElements} {noun}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        Page {page + 1} of {totalPages} · {totalElements} {noun}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={first}
          aria-label="Previous page"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={13} /> Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={last}
          aria-label="Next page"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
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
      <p className="px-4 py-3 text-center text-xs text-gray-400">All {total} shown</p>
    );
  }
  return (
    <button
      onClick={onLoadMore}
      disabled={loading}
      className="w-full px-4 py-3 text-xs font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors"
      style={{ color: NAVY }}
    >
      {loading ? 'Loading…' : `Load more (${loaded} of ${total})`}
    </button>
  );
}
