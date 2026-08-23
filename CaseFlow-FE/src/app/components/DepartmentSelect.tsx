import { departmentGroupsFor, type DepartmentGroup } from './departments';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Picks the student programme list vs the staff faculty/office list. */
  role?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  onFocus?: React.FocusEventHandler<HTMLSelectElement>;
  onBlur?: React.FocusEventHandler<HTMLSelectElement>;
}

/**
 * Department picker backed by AUCA's real faculty structure.
 *
 * Any value already stored that isn't in the current list is kept as a selectable option. Accounts
 * predate this list (and a student who transfers keeps their old programme on file), so without that
 * the select would render blank and silently overwrite their department the moment anything else on
 * the form was saved.
 */
export function DepartmentSelect({
  value, onChange, role, className = '', placeholder = 'Select a department…', disabled, onFocus, onBlur,
}: Props) {
  const groups: readonly DepartmentGroup[] = departmentGroupsFor(role);
  const known = groups.some(g => g.options.includes(value));

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={className}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <option value="">{placeholder}</option>
      {value && !known && (
        <optgroup label="Currently set">
          <option value={value}>{value}</option>
        </optgroup>
      )}
      {groups.map(group => (
        <optgroup key={group.group} label={group.group}>
          {group.options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
