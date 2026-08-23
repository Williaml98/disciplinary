import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Shown once results are in, e.g. "3 matches". */
  resultCount?: number;
  className?: string;
}

/**
 * The one search box used across every list in the app.
 *
 * Callers feed the value through useDebouncedValue into a server-side `search` filter rather than
 * filtering an array — with the lists paginated, client-side filtering would only ever search the
 * page already loaded, which looks like missing data rather than a narrowed view.
 */
export function SearchInput({ value, onChange, placeholder = 'Search…', resultCount, className = '' }: Props) {
  return (
    <div className={`group flex items-center gap-2.5 transition-all duration-[var(--dur)] ease-[var(--ease-out)]
                     focus-within:shadow-[var(--shadow-focus)] focus-within:border-brand-400 ${className}`}>
      <Search size={14} className="text-ink-400 group-focus-within:text-brand-600 shrink-0 transition-colors" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 text-[13px] border-0 outline-none bg-transparent text-ink-800 placeholder-ink-400 min-w-0
                   [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <>
          {resultCount !== undefined && (
            <span className="text-[11px] font-tight font-medium text-ink-400 shrink-0 whitespace-nowrap tabular">
              {resultCount} {resultCount === 1 ? 'match' : 'matches'}
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="text-ink-400 hover:text-ink-700 shrink-0 transition-colors rounded p-0.5"
          >
            <X size={13} />
          </button>
        </>
      )}
    </div>
  );
}
