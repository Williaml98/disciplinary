import { useEffect, useState } from 'react';
import { Download, FileText, FileSpreadsheet, Eye, SlidersHorizontal, CalendarRange, FileSearch, LoaderCircle } from 'lucide-react';
import { PageHeader, PrimaryButton } from './DashboardLayout';
import { OFFENSE_TYPES } from './offenseTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import type { CaseStatus, DecisionType } from './mockData';
import { downloadCasesReport, previewCasesReport } from '../../lib/api';
import { STAFF_DEPARTMENT_GROUPS, STUDENT_DEPARTMENT_GROUPS } from './departments';
import { notifyError, notifySuccess } from '../../lib/toast';

/** One control treatment for every text input and select on this screen. */
const INPUT_CLS =
  'w-full rounded-xl border border-[var(--hairline)] bg-white px-3.5 py-2.5 text-[13px] text-ink-800 ' +
  'placeholder-ink-400 outline-none transition-all duration-[var(--dur)] ease-[var(--ease-out)] ' +
  'focus:border-brand-400 focus:shadow-[var(--shadow-focus)]';
const LABEL_CLS = 'block text-[13px] font-medium text-ink-700 mb-1.5';

const SECONDARY_BTN_CLS =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] bg-white px-4 py-2.5 ' +
  'text-sm font-medium text-ink-700 hover:bg-ink-50 hover:border-[var(--hairline-strong)] ' +
  'transition-all duration-[var(--dur)] ease-[var(--ease-out)] disabled:opacity-60 disabled:cursor-not-allowed';

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

/** Display names for the read-only summary of which filters are currently narrowing the export. */
const FILTER_LABELS: Record<keyof Filters, string> = {
  reportDateFrom: 'From',
  reportDateTo: 'To',
  offenseType: 'Offense',
  status: 'Status',
  decision: 'Decision',
  reporterDepartment: 'Department',
  reportedBy: 'Reported by',
};

// Minimal RFC4180-style parser (quoted fields, "" escaping) — enough for the simple,
// single-line-per-row CSV CaseReportService generates; not a general-purpose CSV parser.
function parseCsv(text: string): string[][] {
  return text.trim().split(/\r\n|\n/).map(line => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  });
}

export function ReportsPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<'pdf' | 'csv'>('pdf');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewCsvRows, setPreviewCsvRows] = useState<string[][]>([]);

  // Revoke the blob URL whenever it's replaced or the component unmounts, so previewing
  // several reports in a row doesn't leak memory.
  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(f => ({ ...f, [key]: value }));
  }

  function buildFilterPayload() {
    return {
      format,
      reportDateFrom: filters.reportDateFrom || undefined,
      reportDateTo: filters.reportDateTo || undefined,
      offenseType: filters.offenseType || undefined,
      status: (filters.status || undefined) as CaseStatus | undefined,
      decision: (filters.decision || undefined) as DecisionType | undefined,
      reporterDepartment: filters.reporterDepartment || undefined,
      reportedBy: filters.reportedBy || undefined,
    };
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await downloadCasesReport(buildFilterPayload());
      notifySuccess(`Report downloaded as ${format.toUpperCase()}.`);
    } catch (err) {
      notifyError(err, 'Unable to generate the report. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    try {
      const blob = await previewCasesReport(buildFilterPayload());
      if (format === 'pdf') {
        if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
        setPreviewPdfUrl(URL.createObjectURL(blob));
      } else {
        setPreviewCsvRows(parseCsv(await blob.text()));
      }
      setPreviewFormat(format);
      setPreviewOpen(true);
    } catch (err) {
      notifyError(err, 'Unable to preview the report. Please try again.');
    } finally {
      setPreviewing(false);
    }
  }

  // Purely a display summary of the state above — nothing here drives the request.
  const activeFilters = (Object.keys(FILTER_LABELS) as (keyof Filters)[])
    .filter(key => filters[key] !== '')
    .map(key => ({ key, label: FILTER_LABELS[key], value: filters[key] }));

  return (
    <>
      <PageHeader title="Reports" subtitle="Build a filtered export of disciplinary cases" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-3xl mx-auto rise">
          <div className="card p-6 space-y-6">
            {/* ---- Builder header ------------------------------------------------ */}
            <div className="flex items-start gap-3.5 pb-5 border-b border-[var(--hairline)]">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <SlidersHorizontal size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="display-md text-ink-900">Report Builder</h2>
                <p className="text-[13px] text-ink-500 mt-0.5">
                  Every filter you set narrows the export. Leave one blank to include everything.
                </p>
              </div>
            </div>

            {/* ---- Date range ---------------------------------------------------- */}
            <section className="space-y-3">
              <p className="eyebrow flex items-center gap-1.5">
                <CalendarRange size={13} aria-hidden="true" /> Date range
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="report-date-from" className={LABEL_CLS}>Report date from</label>
                  <input id="report-date-from" type="date" value={filters.reportDateFrom}
                    onChange={e => update('reportDateFrom', e.target.value)} className={`${INPUT_CLS} tabular`} />
                </div>
                <div>
                  <label htmlFor="report-date-to" className={LABEL_CLS}>Report date to</label>
                  <input id="report-date-to" type="date" value={filters.reportDateTo}
                    onChange={e => update('reportDateTo', e.target.value)} className={`${INPUT_CLS} tabular`} />
                </div>
              </div>
            </section>

            {/* ---- Case attributes ----------------------------------------------- */}
            <section className="space-y-3 pt-1">
              <p className="eyebrow">Case attributes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="report-offense" className={LABEL_CLS}>Offense type</label>
                  <select id="report-offense" value={filters.offenseType} onChange={e => update('offenseType', e.target.value)} className={INPUT_CLS}>
                    <option value="">All offense types</option>
                    {OFFENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="report-status" className={LABEL_CLS}>Case status</label>
                  <select id="report-status" value={filters.status} onChange={e => update('status', e.target.value)} className={INPUT_CLS}>
                    <option value="">All statuses</option>
                    {CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="report-decision" className={LABEL_CLS}>Decision</label>
                  <select id="report-decision" value={filters.decision} onChange={e => update('decision', e.target.value)} className={INPUT_CLS}>
                    <option value="">All decisions</option>
                    {DECISION_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* ---- Origin -------------------------------------------------------- */}
            <section className="space-y-3 pt-1">
              <p className="eyebrow">Origin</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="report-department" className={LABEL_CLS}>Department</label>
                  {/* The backend matches this as a case-insensitive substring, so picking a faculty
                      also matches the departments filed under it. */}
                  <select id="report-department" value={filters.reporterDepartment}
                    onChange={e => update('reporterDepartment', e.target.value)}
                    className={INPUT_CLS}>
                    <option value="">Any department</option>
                    {[...STAFF_DEPARTMENT_GROUPS, ...STUDENT_DEPARTMENT_GROUPS].map(group => (
                      <optgroup key={group.group} label={group.group}>
                        {group.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <p className="text-[12px] text-ink-500 mt-1.5">Selecting a faculty also includes the departments filed under it.</p>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="report-reported-by" className={LABEL_CLS}>Reported by</label>
                  <input id="report-reported-by" type="text" value={filters.reportedBy}
                    onChange={e => update('reportedBy', e.target.value)}
                    placeholder="e.g. Dr. Marie Claire Uwase" className={INPUT_CLS} />
                </div>
              </div>
            </section>

            {/* ---- Format -------------------------------------------------------- */}
            <section className="space-y-3 pt-5 border-t border-[var(--hairline)]">
              <p className="eyebrow">Output format</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={() => setFormat('pdf')} aria-pressed={format === 'pdf'}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                    format === 'pdf'
                      ? 'border-brand-400 bg-brand-50/70 text-brand-800 shadow-[var(--shadow-focus)]'
                      : 'border-[var(--hairline)] bg-white text-ink-600 hover:bg-ink-50 hover:border-[var(--hairline-strong)]'
                  }`}>
                  <FileText size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold font-tight">PDF</span>
                    <span className="block text-[12px] text-ink-500 mt-0.5">Branded, print-ready document</span>
                  </span>
                </button>
                <button type="button" onClick={() => setFormat('csv')} aria-pressed={format === 'csv'}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                    format === 'csv'
                      ? 'border-brand-400 bg-brand-50/70 text-brand-800 shadow-[var(--shadow-focus)]'
                      : 'border-[var(--hairline)] bg-white text-ink-600 hover:bg-ink-50 hover:border-[var(--hairline-strong)]'
                  }`}>
                  <FileSpreadsheet size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold font-tight">CSV</span>
                    <span className="block text-[12px] text-ink-500 mt-0.5">Raw rows for spreadsheets</span>
                  </span>
                </button>
              </div>
            </section>

            {/* ---- Active-filter summary (read-only) ----------------------------- */}
            <div className="rounded-xl bg-ink-50/70 border border-[var(--hairline)] px-4 py-3">
              {activeFilters.length === 0 ? (
                <p className="text-[13px] text-ink-500">
                  <span className="font-medium text-ink-700">No filters applied.</span> The export will include every case you can access.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow mr-0.5">Applied</span>
                  {activeFilters.map(f => (
                    <span key={f.key}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold
                                 text-brand-800 ring-1 ring-inset ring-brand-200 font-tight max-w-full">
                      <span className="text-brand-600/80 font-medium">{f.label}</span>
                      <span className="tabular truncate">{f.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ---- Actions ------------------------------------------------------- */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button type="button" onClick={handlePreview} disabled={previewing}
                className={`${SECONDARY_BTN_CLS} flex-1 py-3`}>
                {previewing
                  ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                  : <Eye size={15} aria-hidden="true" />}
                {previewing ? 'Loading…' : 'Preview'}
              </button>
              <PrimaryButton type="button" onClick={handleGenerate} disabled={generating} className="flex-1 py-3">
                {generating
                  ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                  : <Download size={15} aria-hidden="true" />}
                {generating ? 'Generating…' : `Generate ${format.toUpperCase()}`}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border-[var(--hairline)] bg-surface shadow-[var(--shadow-xl)]">
          <DialogHeader>
            <DialogTitle className="display-md text-ink-900">Report Preview</DialogTitle>
            <DialogDescription className="text-[13px] text-ink-500">
              {previewFormat === 'pdf'
                ? 'This is exactly what the downloaded PDF will look like.'
                : `${Math.max(previewCsvRows.length - 1, 0)} case(s) will be included in the CSV.`}
            </DialogDescription>
          </DialogHeader>

          {previewFormat === 'pdf' ? (
            previewPdfUrl && (
              <iframe src={previewPdfUrl} title="Report preview"
                className="w-full flex-1 min-h-[60vh] rounded-xl border border-[var(--hairline)] bg-ink-50 shadow-[var(--shadow-xs)]" />
            )
          ) : (
            <div className="flex-1 overflow-auto rounded-xl border border-[var(--hairline)] shadow-[var(--shadow-xs)]">
              {previewCsvRows.length <= 1 ? (
                <div className="flex flex-col items-center justify-center text-center px-6 py-14">
                  <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center">
                    <FileSearch size={20} className="text-ink-400" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-ink-800 mt-4">No cases match these filters</p>
                  <p className="text-[13px] text-ink-500 mt-1 max-w-xs">
                    Widen the date range or clear a filter, then preview again.
                  </p>
                </div>
              ) : (
                <Table>
                  {previewCsvRows.length > 0 && (
                    <TableHeader>
                      <TableRow className="bg-ink-50/70 border-b border-[var(--hairline)] hover:bg-ink-50/70">
                        {previewCsvRows[0].map((header, i) => (
                          <TableHead key={i} className="eyebrow px-3 py-2.5 whitespace-nowrap">{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                  )}
                  <TableBody>
                    {previewCsvRows.slice(1).map((row, i) => (
                      <TableRow key={i}
                        className="border-b border-[var(--hairline)] hover:bg-brand-50/40 transition-colors duration-[var(--dur)]">
                        {row.map((cell, j) => (
                          <TableCell key={j} className="px-3 py-2.5 text-[13px] text-ink-700 tabular">{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          <DialogFooter className="sm:justify-between sm:items-center gap-3 pt-4 border-t border-[var(--hairline)]">
            <p className="text-[12px] text-ink-500 hidden sm:block">
              Downloading saves exactly what is shown here.
            </p>
            <PrimaryButton type="button" onClick={handleGenerate} disabled={generating}>
              {generating
                ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                : <Download size={15} aria-hidden="true" />}
              {generating ? 'Generating…' : 'Download'}
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
