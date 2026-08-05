import { useState } from 'react';
import { Download, AlertCircle, FileText, FileSpreadsheet } from 'lucide-react';
import { PageHeader } from './DashboardLayout';
import { OFFENSE_TYPES } from './offenseTypes';
import type { CaseStatus, DecisionType } from './mockData';
import { downloadCasesReport, ApiError } from '../../lib/api';

const NAVY = '#1D3A5F';
const INPUT_CLS = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3A5F] focus:border-transparent bg-white';
const LABEL_CLS = 'block text-sm text-gray-700 mb-1.5';

const CASE_STATUSES: CaseStatus[] = ['Reported', 'Under Review', 'Decided', 'Under Appeal', 'Resolved'];
const DECISION_TYPES: DecisionType[] = ['Warning', 'Probation', 'Semester Suspension', 'Expulsion', 'Cleared'];

interface Filters {
  reportDateFrom: string;
  reportDateTo: string;
  offenseType: string;
  status: string;
  decision: string;
  reporterDepartment: string;
  reportedBy: string;
}

const EMPTY_FILTERS: Filters = {
  reportDateFrom: '', reportDateTo: '', offenseType: '', status: '', decision: '',
  reporterDepartment: '', reportedBy: '',
};

export function ReportsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(f => ({ ...f, [key]: value }));
  }

  async function handleGenerate() {
    setError('');
    setGenerating(true);
    try {
      await downloadCasesReport({
        format,
        reportDateFrom: filters.reportDateFrom || undefined,
        reportDateTo: filters.reportDateTo || undefined,
        offenseType: filters.offenseType || undefined,
        status: (filters.status || undefined) as CaseStatus | undefined,
        decision: (filters.decision || undefined) as DecisionType | undefined,
        reporterDepartment: filters.reporterDepartment || undefined,
        reportedBy: filters.reportedBy || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to generate the report. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate a filtered export of disciplinary cases" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Filters</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>Report Date From</label>
                <input type="date" value={filters.reportDateFrom}
                  onChange={e => update('reportDateFrom', e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Report Date To</label>
                <input type="date" value={filters.reportDateTo}
                  onChange={e => update('reportDateTo', e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Offense Type</label>
                <select value={filters.offenseType} onChange={e => update('offenseType', e.target.value)} className={INPUT_CLS}>
                  <option value="">All offense types</option>
                  {OFFENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Case Status</label>
                <select value={filters.status} onChange={e => update('status', e.target.value)} className={INPUT_CLS}>
                  <option value="">All statuses</option>
                  {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Decision</label>
                <select value={filters.decision} onChange={e => update('decision', e.target.value)} className={INPUT_CLS}>
                  <option value="">All decisions</option>
                  {DECISION_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Department</label>
                <input type="text" value={filters.reporterDepartment}
                  onChange={e => update('reporterDepartment', e.target.value)}
                  placeholder="e.g. Computer Science" className={INPUT_CLS} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL_CLS}>Reported By</label>
                <input type="text" value={filters.reportedBy}
                  onChange={e => update('reportedBy', e.target.value)}
                  placeholder="e.g. Dr. Marie Claire Uwase" className={INPUT_CLS} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Format</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setFormat('pdf')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm transition-colors ${
                  format === 'pdf' ? 'border-[#1D3A5F] bg-[#1D3A5F]/5 text-[#1D3A5F]' : 'border-gray-300 text-gray-600'
                }`}>
                <FileText size={15} /> PDF
              </button>
              <button type="button" onClick={() => setFormat('csv')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm transition-colors ${
                  format === 'csv' ? 'border-[#1D3A5F] bg-[#1D3A5F]/5 text-[#1D3A5F]' : 'border-gray-300 text-gray-600'
                }`}>
                <FileSpreadsheet size={15} /> CSV
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button type="button" onClick={handleGenerate} disabled={generating}
            className="w-full flex items-center justify-center gap-2 text-white rounded-xl py-3 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: NAVY }}>
            <Download size={15} /> {generating ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
      </div>
    </>
  );
}
