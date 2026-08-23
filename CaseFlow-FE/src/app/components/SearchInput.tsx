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
    <div className={`flex items-center gap-2 ${className}`}>
      <Search size={14} className="text-gray-400 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 text-sm border-0 outline-none bg-transparent text-gray-700 placeholder-gray-400 min-w-0
                   [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <>
          {resultCount !== undefined && (
            <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
              {resultCount} {resultCount === 1 ? 'match' : 'matches'}
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
          >
            <X size={13} />
          </button>
        </>
      )}
    </div>
  );
}
