import { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { fetchAllowedStatuses, updateCaseStatus } from '../../lib/api';
import { notifyError, notifySuccess, toMessage } from '../../lib/toast';
import type { CaseStatus, DisciplinaryCase } from './mockData';
import { StatusBadge } from './DashboardLayout';

const NAVY = '#1D3A5F';

/**
 * Manual status change for committee members and admins.
 *
 * The backend endpoint existed but nothing in the app ever called it, which is why a warned student's
 * case had no way to leave "Decided". The options come from the server's own state machine rather than
 * being hardcoded here, so the UI can never offer a move the server will reject — and a case with no
 * legal manual moves (one under appeal, say) renders an explanation instead of a dead control.
 */
export function StatusChanger({ c, actor, onChanged }: {
  c: DisciplinaryCase;
  actor: string;
  onChanged: (updated: DisciplinaryCase) => void;
}) {
  const [allowed, setAllowed] = useState<CaseStatus[] | null>(null);
  const [target, setTarget] = useState<CaseStatus | ''>('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    setAllowed(null);
    setTarget('');
    setLoadError('');
    fetchAllowedStatuses(c.id)
      .then(result => active && setAllowed(result))
      .catch(err => active && setLoadError(toMessage(err, 'Unable to load status options.')));
    return () => {
      active = false;
    };
  }, [c.id, c.status]);

  async function apply() {
    if (!target) return;
    setSaving(true);
    try {
      const updated = await updateCaseStatus(c.id, target, actor);
      onChanged(updated);
      setTarget('');
      notifySuccess(`Status changed to ${updated.status}.`);
    } catch (err) {
      notifyError(err, 'Unable to change the status. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-1">
        <ArrowRightLeft size={14} style={{ color: NAVY }} />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Status</p>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Currently <StatusBadge status={c.status} />
      </p>

      {loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : allowed === null ? (
        <p className="text-sm text-gray-400">Loading options…</p>
      ) : allowed.length === 0 ? (
        <p className="text-sm text-gray-500">
          A case that is {c.status} can't be moved by hand — finish it through the appeal resolution
          instead.
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={target}
            onChange={e => setTarget(e.target.value as CaseStatus | '')}
            disabled={saving}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1D3A5F] disabled:opacity-60"
          >
            <option value="">Select a new status…</option>
            {allowed.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button
            onClick={apply}
            disabled={!target || saving}
            className="text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:bg-gray-200 disabled:text-gray-400 transition-opacity"
            style={target && !saving ? { backgroundColor: NAVY } : undefined}
          >
            {saving ? 'Updating…' : 'Update status'}
          </button>
        </div>
      )}
    </div>
  );
}
