import { useEffect, useState } from 'react';
import { Download, FileText, FileSpreadsheet, Eye } from 'lucide-react';
import { PageHeader } from './DashboardLayout';
import { OFFENSE_TYPES } from './offenseTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/table';
import type { CaseStatus, DecisionType } from './mockData';
import { downloadCasesReport, previewCasesReport } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/toast';

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

          <div className="flex gap-3">
            <button type="button" onClick={handlePreview} disabled={previewing}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors">
              <Eye size={15} /> {previewing ? 'Loading…' : 'Preview'}
            </button>
            <button type="button" onClick={handleGenerate} disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 text-white rounded-xl py-3 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: NAVY }}>
              <Download size={15} /> {generating ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Report Preview</DialogTitle>
            <DialogDescription>
              {previewFormat === 'pdf'
                ? 'This is exactly what the downloaded PDF will look like.'
                : `${Math.max(previewCsvRows.length - 1, 0)} case(s) will be included in the CSV.`}
            </DialogDescription>
          </DialogHeader>

          {previewFormat === 'pdf' ? (
            previewPdfUrl && (
              <iframe src={previewPdfUrl} title="Report preview" className="w-full flex-1 min-h-[60vh] border border-gray-200 rounded-lg" />
            )
          ) : (
            <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
              <Table>
                {previewCsvRows.length > 0 && (
                  <TableHeader>
                    <TableRow>
                      {previewCsvRows[0].map((header, i) => <TableHead key={i}>{header}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                )}
                <TableBody>
                  {previewCsvRows.slice(1).map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <button type="button" onClick={handleGenerate} disabled={generating}
              className="flex items-center justify-center gap-2 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: NAVY }}>
              <Download size={15} /> {generating ? 'Generating…' : 'Download'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
