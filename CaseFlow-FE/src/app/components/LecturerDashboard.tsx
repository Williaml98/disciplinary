import { useEffect, useRef, useState } from 'react';
import { FilePlus, List, ChevronRight, Paperclip, AlertCircle, Scale, ImagePlus, X, BarChart3 } from 'lucide-react';
import { DashboardLayout, PageHeader, StatusBadge, EvidenceGallery } from './DashboardLayout';
import { DisciplinaryRulesPage } from './DisciplinaryRulesPage';
import { ReportsPage } from './ReportsPage';
import { OFFENSE_TYPES } from './offenseTypes';
import type { AppUser, DisciplinaryCase } from './mockData';
import { reportCase, uploadEvidence } from '../../lib/api';
import { usePagedCases } from '../../lib/usePagedCases';
import { useDebouncedValue } from '../../lib/hooks';
import { Pagination } from './Pagination';
import { SearchInput } from './SearchInput';
import { notifyError, notifySuccess, toMessage, toast } from '../../lib/toast';

/** A file staged for upload, paired with the blob URL used to preview it. */
interface PendingEvidence {
  file: File;
  previewUrl: string;
}

interface Props {
  user: AppUser;
  onLogout: () => void;
  onUpdateProfile: (updated: AppUser) => void;
}

const navItems = [
  { id: 'report', label: 'Report New Incident', icon: <FilePlus size={16} /> },
  { id: 'mycases', label: 'My Reported Cases', icon: <List size={16} /> },
  { id: 'rules', label: 'Disciplinary Rules', icon: <Scale size={16} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={16} /> },
];

export function LecturerDashboard({ user, onLogout, onUpdateProfile }: Props) {
  const [activeNav, setActiveNav] = useState('report');
  const [form, setForm] = useState({
    studentName: '',
    studentId: '',
    offenseType: '',
    description: '',
    evidence: '',
  });
  // Each attachment carries its own preview URL, created once when the file is picked.
  const [evidenceFiles, setEvidenceFiles] = useState<PendingEvidence[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCase, setSelectedCase] = useState<DisciplinaryCase | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caseSearch, setCaseSearch] = useState('');
  const debouncedCaseSearch = useDebouncedValue(caseSearch, 300);

  // reportedByExact, not the report endpoint's substring match: "Marie Uwase" must not be shown the
  // cases filed by "Dr. Marie Uwase". Search narrows within that, server-side.
  const paged = usePagedCases(
    { reportedByExact: user.name, search: debouncedCaseSearch || undefined },
    { size: 20, sort: 'reportDate,desc' },
  );
  const myCases = paged.items;

  // Deliberately unfiltered. The nav badge answers "how many cases have I filed", so it must not move
  // when the search box narrows the list — size 1 because only the count is used.
  const myCaseTotal = usePagedCases({ reportedByExact: user.name }, { size: 1 });

  // Revoke whatever is still outstanding when the component goes away. Individual URLs are revoked
  // as their file is removed; this only catches the ones still on screen at unmount.
  const outstandingUrls = useRef<string[]>([]);
  outstandingUrls.current = evidenceFiles.map(f => f.previewUrl);
  useEffect(() => () => outstandingUrls.current.forEach(URL.revokeObjectURL), []);

  function addEvidenceFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    // Snapshot eagerly. A FileList is a *live* view of the input element, and the change handler
    // clears input.value immediately after calling this — which empties that same FileList in place.
    // Reading it inside the setState updater (which React runs later) therefore saw zero files, so
    // nothing was ever added and no thumbnail appeared.
    const added = Array.from(fileList).map(file => ({
      file,
      // Created once per file rather than recreated for the whole list on every change, so a preview
      // URL stays stable for as long as its file is attached.
      previewUrl: URL.createObjectURL(file),
    }));
    setEvidenceFiles(prev => [...prev, ...added]);
  }

  function removeEvidenceFile(index: number) {
    setEvidenceFiles(prev => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let newCase = await reportCase({
        studentName: form.studentName,
        studentId: form.studentId,
        reportedBy: user.name,
        reporterDepartment: user.department || '',
        offenseType: form.offenseType,
        description: form.description,
        evidence: form.evidence,
      });
      let uploadFailure = '';
      if (evidenceFiles.length > 0) {
        try {
          newCase = await uploadEvidence(newCase.id, evidenceFiles.map(e => e.file), user.name);
        } catch (uploadErr) {
          uploadFailure = toMessage(uploadErr, 'the upload was rejected');
        }
      }
      // Reload rather than prepending: whether the new case belongs on the current page depends on the
      // sort and filters, and a reload is unconditionally right. It also ticks the badge over.
      paged.reload();
      setSubmitted(true);
      setForm({ studentName: '', studentId: '', offenseType: '', description: '', evidence: '' });
      setEvidenceFiles(prev => {
        prev.forEach(e => URL.revokeObjectURL(e.previewUrl));
        return [];
      });
      setTimeout(() => setSubmitted(false), 5000);

      // A partial success: the case exists, so this is a warning about the attachments rather than a
      // failure of the report itself. Saying only "failed" would be wrong — the case is filed.
      if (uploadFailure) {
        toast.warning(`Case ${newCase.id} was filed without its attachments.`, {
          description: `The evidence files could not be uploaded: ${uploadFailure}`,
        });
      } else {
        notifySuccess(`Case ${newCase.id} filed.`, 'The disciplinary committee has been notified.');
      }
    } catch (err) {
      notifyError(err, 'Unable to submit the report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Global count from the server, so the badge stays right regardless of paging or searching.
  const myCaseBadge = myCaseTotal.totalElements;

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      onUpdateProfile={onUpdateProfile}
      navItems={navItems.map(n => n.id === 'mycases' ? { ...n, badge: myCaseBadge } : n)}
      activeNav={activeNav}
      onNavChange={id => { setActiveNav(id); setSelectedCase(null); }}
    >
      {activeNav === 'report' && (
        <>
          <PageHeader title="Report New Incident" subtitle="Submit a disciplinary incident for committee review" />
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="max-w-2xl mx-auto">
              {submitted && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle size={18} className="text-green-600 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Incident reported successfully</p>
                    <p className="text-xs mt-0.5 text-green-700">The case has been created and the disciplinary committee has been notified.</p>
                  </div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Student Information</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Student Full Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={form.studentName}
                        onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))}
                        placeholder="e.g. Jean Bosco Habimana"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3A5F] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Student ID <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={form.studentId}
                        onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                        placeholder="e.g. 21045"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3A5F] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Incident Details</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Offense Type <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={form.offenseType}
                        onChange={e => setForm(f => ({ ...f, offenseType: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3A5F] focus:border-transparent bg-white"
                      >
                        <option value="">Select offense type...</option>
                        {OFFENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">Description of Incident <span className="text-red-500">*</span></label>
                      <textarea
                        required
                        rows={5}
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Provide a detailed description of the incident, including date, time, location, and what occurred..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3A5F] focus:border-transparent resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">
                        <span className="flex items-center gap-1.5"><Paperclip size={14} /> Evidence Description</span>
                      </label>
                      <textarea
                        rows={2}
                        value={form.evidence}
                        onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))}
                        placeholder="Describe any physical or digital evidence (e.g. confiscated notes, screenshots, witness statements)..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3A5F] focus:border-transparent resize-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">Physical evidence should be submitted to the Student Affairs office with case reference number.</p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1.5">
                        <span className="flex items-center gap-1.5"><ImagePlus size={14} /> Evidence Photos</span>
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={e => { addEvidenceFiles(e.target.files); e.target.value = ''; }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-[#1D3A5F]/40 hover:text-[#1D3A5F] transition-colors"
                      >
                        <ImagePlus size={15} /> Upload one or more photos
                      </button>
                      {evidenceFiles.length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-3">
                          {evidenceFiles.map((item, i) => (
                            <div key={item.previewUrl} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                              <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeEvidenceFile(i)}
                                className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <p className="text-xs text-amber-800">
                      <strong>Note:</strong> By submitting this form, you confirm that the information provided is accurate and complete to the best of your knowledge. Submitting false reports is itself a disciplinary offense.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#1D3A5F] hover:bg-[#162d4a] disabled:opacity-60 text-white rounded-xl py-3 text-sm font-medium transition-colors"
                  >
                    {submitting ? 'Submitting…' : 'Submit Incident Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {activeNav === 'mycases' && (
        <>
          <PageHeader
            title="My Reported Cases"
            subtitle={caseSearch
              ? `${paged.totalElements} of ${myCaseBadge} case${myCaseBadge !== 1 ? 's' : ''} match your search`
              : `${myCaseBadge} case${myCaseBadge !== 1 ? 's' : ''} submitted by you`}
          />
          {selectedCase ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <button
                onClick={() => setSelectedCase(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors"
              >
                ← Back to cases
              </button>
              <CaseDetailReadOnly c={selectedCase} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="max-w-3xl mx-auto mb-4">
                <SearchInput
                  value={caseSearch}
                  onChange={setCaseSearch}
                  placeholder="Search your cases by student, ID, case number or offense…"
                  resultCount={caseSearch ? paged.totalElements : undefined}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-2.5"
                />
              </div>
              {paged.loading && myCases.length === 0 ? (
                <p className="text-center py-16 text-sm text-gray-400">Loading your cases…</p>
              ) : paged.error ? (
                <div className="max-w-3xl mx-auto flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="shrink-0" />
                  <p className="text-sm">{paged.error}</p>
                </div>
              ) : myCases.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <FilePlus size={40} className="mx-auto mb-3 opacity-30" />
                  {caseSearch ? (
                    <>
                      <p className="text-sm">No cases match "{caseSearch}".</p>
                      <p className="text-xs mt-1">Try a student name, ID, case number or offense.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">No cases reported yet.</p>
                      <p className="text-xs mt-1">Use "Report New Incident" to submit a case.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-3">
                  {myCases.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCase(c)}
                      className="w-full bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-[#1D3A5F]/40 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-mono text-gray-400">{c.id}</span>
                            <StatusBadge status={c.status} />
                          </div>
                          <p className="text-sm text-gray-900">{c.studentName} — <span className="text-gray-500">{c.offenseType}</span></p>
                          <p className="text-xs text-gray-400 mt-1">Reported {c.reportDate}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-[#1D3A5F] transition-colors mt-1 shrink-0" />
                      </div>
                    </button>
                  ))}
                  <div className="bg-white border border-gray-200 rounded-2xl">
                    <Pagination
                      page={paged.page}
                      totalPages={paged.totalPages}
                      totalElements={paged.totalElements}
                      first={paged.first}
                      last={paged.last}
                      onPageChange={paged.setPage}
                      label="case"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeNav === 'rules' && <DisciplinaryRulesPage />}
      {activeNav === 'reports' && <ReportsPage />}
    </DashboardLayout>
  );
}

function CaseDetailReadOnly({ c }: { c: DisciplinaryCase }) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-mono text-gray-400 mb-1">{c.id}</p>
            <h2 className="text-lg text-gray-900">{c.studentName}</h2>
            <p className="text-sm text-gray-500">Student ID: {c.studentId}</p>
          </div>
          <StatusBadge status={c.status} />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Offense:</span> <span className="text-gray-900 ml-1">{c.offenseType}</span></div>
          <div><span className="text-gray-500">Reported:</span> <span className="text-gray-900 ml-1">{c.reportDate}</span></div>
          {c.decision && <div><span className="text-gray-500">Decision:</span> <span className="ml-1"><StatusBadge status={c.decision} /></span></div>}
          <div><span className="text-gray-500">Registration:</span> <span className="ml-1"><StatusBadge status={c.registrationStatus} /></span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Description</p>
        <p className="text-sm text-gray-700 leading-relaxed">{c.description}</p>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Evidence Submitted</p>
        <p className="text-sm text-gray-700">{c.evidence}</p>
        <EvidenceGallery files={c.evidenceFiles} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Case Timeline</p>
        <div className="space-y-3">
          {c.auditTrail.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-[#1D3A5F] mt-1.5 shrink-0" />
                {i < c.auditTrail.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
              </div>
              <div className="pb-3 min-w-0">
                <p className="text-sm text-gray-800">{entry.action}</p>
                <p className="text-xs text-gray-400 mt-0.5">{entry.by} · {entry.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
