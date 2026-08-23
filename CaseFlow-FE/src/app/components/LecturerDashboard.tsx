import { useEffect, useRef, useState } from 'react';
import {
  FilePlus, List, ChevronRight, Paperclip, AlertCircle, Scale, ImagePlus, X, BarChart3,
  ArrowLeft, CheckCircle2, Send, ShieldAlert, SearchX,
} from 'lucide-react';
import { DashboardLayout, PageHeader, PrimaryButton, StatusBadge, EvidenceGallery } from './DashboardLayout';
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

/** One control treatment for every text input, select and textarea on this screen. */
const fieldClass =
  'w-full rounded-xl border border-[var(--hairline)] bg-white px-3.5 py-2.5 text-[13px] text-ink-800 ' +
  'placeholder-ink-400 outline-none transition-all duration-[var(--dur)] ease-[var(--ease-out)] ' +
  'focus:border-brand-400 focus:shadow-[var(--shadow-focus)]';

const labelClass = 'block text-[13px] font-medium text-ink-700 mb-1.5';

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

  // Keyed on the account id so renaming yourself doesn't orphan your cases; the name is still sent
  // as a fallback for cases filed before the id column existed. Search narrows within that.
  const mine = { reportedByUserId: user.id, reportedByExact: user.name };
  const paged = usePagedCases(
    { ...mine, search: debouncedCaseSearch || undefined },
    { size: 20, sort: 'reportDate,desc' },
  );
  const myCases = paged.items;

  // Deliberately unfiltered. The nav badge answers "how many cases have I filed", so it must not move
  // when the search box narrows the list — size 1 because only the count is used.
  const myCaseTotal = usePagedCases(mine, { size: 1 });

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
            <div className="max-w-2xl mx-auto rise">
              {submitted && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50 p-4">
                  <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} className="text-emerald-700" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-900">Incident reported successfully</p>
                    <p className="text-[13px] mt-0.5 text-emerald-800/80">
                      The case has been created and the disciplinary committee has been notified.
                    </p>
                  </div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="card p-6 sm:p-7 space-y-6">
                <div>
                  <p className="eyebrow mb-1">Student Information</p>
                  <p className="text-[13px] text-ink-500 mb-4">Who the report concerns.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass} htmlFor="studentName">
                        Student Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="studentName"
                        type="text"
                        required
                        value={form.studentName}
                        onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))}
                        placeholder="e.g. Jean Bosco Habimana"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="studentId">
                        Student ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="studentId"
                        type="text"
                        required
                        value={form.studentId}
                        onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                        placeholder="e.g. 21045"
                        className={`${fieldClass} font-mono tabular`}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--hairline)] pt-6">
                  <p className="eyebrow mb-1">Incident Details</p>
                  <p className="text-[13px] text-ink-500 mb-4">What happened, in the committee's words as well as yours.</p>
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass} htmlFor="offenseType">
                        Offense Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="offenseType"
                        required
                        value={form.offenseType}
                        onChange={e => setForm(f => ({ ...f, offenseType: e.target.value }))}
                        className={fieldClass}
                      >
                        <option value="">Select offense type...</option>
                        {OFFENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="description">
                        Description of Incident <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        id="description"
                        required
                        rows={5}
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Provide a detailed description of the incident, including date, time, location, and what occurred..."
                        className={`${fieldClass} resize-none leading-relaxed`}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="evidence">
                        <span className="flex items-center gap-1.5">
                          <Paperclip size={14} className="text-ink-400" /> Evidence Description
                        </span>
                      </label>
                      <textarea
                        id="evidence"
                        rows={2}
                        value={form.evidence}
                        onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))}
                        placeholder="Describe any physical or digital evidence (e.g. confiscated notes, screenshots, witness statements)..."
                        className={`${fieldClass} resize-none leading-relaxed`}
                      />
                      <p className="text-[12px] text-ink-400 mt-1.5">
                        Physical evidence should be submitted to the Student Affairs office with case reference number.
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>
                        <span className="flex items-center gap-1.5">
                          <ImagePlus size={14} className="text-ink-400" /> Evidence Photos
                        </span>
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={e => { addEvidenceFiles(e.target.files); e.target.value = ''; }}
                        className="hidden"
                        aria-label="Choose evidence photos"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--hairline-strong)]
                                   bg-ink-50/60 py-5 text-ink-500
                                   hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700
                                   transition-all duration-[var(--dur)] ease-[var(--ease-out)]"
                      >
                        <ImagePlus size={18} />
                        <span className="text-[13px] font-medium">Upload one or more photos</span>
                        <span className="text-[11px] font-tight text-ink-400">JPG, PNG, GIF or WEBP</span>
                      </button>
                      {evidenceFiles.length > 0 && (
                        <div className="mt-3 rounded-xl border border-[var(--hairline)] bg-ink-50/60 p-3">
                          <p className="eyebrow mb-2.5 tabular">
                            {evidenceFiles.length} photo{evidenceFiles.length !== 1 ? 's' : ''} attached
                          </p>
                          <div className="flex flex-wrap gap-2.5">
                            {evidenceFiles.map((item, i) => (
                              <div
                                key={item.previewUrl}
                                className="group relative w-[68px] h-[68px] rounded-xl overflow-hidden bg-white shrink-0
                                           ring-1 ring-[var(--hairline-strong)] shadow-[var(--shadow-xs)]"
                              >
                                <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeEvidenceFile(i)}
                                  aria-label={`Remove ${item.file.name}`}
                                  className="absolute top-1 right-1 rounded-full bg-ink-950/60 p-1 text-white
                                             hover:bg-ink-950/85 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--hairline)] pt-6">
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-4 mb-5">
                    <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
                    <p className="text-[12px] leading-relaxed text-amber-900">
                      <strong className="font-semibold">Before you submit.</strong> You confirm that the information provided
                      is accurate and complete to the best of your knowledge. Submitting false reports is itself a
                      disciplinary offense.
                    </p>
                  </div>
                  <PrimaryButton type="submit" disabled={submitting} className="w-full py-3">
                    <Send size={15} />
                    {submitting ? 'Submitting…' : 'Submit Incident Report'}
                  </PrimaryButton>
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
                type="button"
                onClick={() => setSelectedCase(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white px-3 py-2 mb-5
                           text-[13px] font-medium text-ink-700 hover:bg-ink-50 hover:border-[var(--hairline-strong)]
                           transition-all duration-[var(--dur)] ease-[var(--ease-out)]"
              >
                <ArrowLeft size={14} /> Back to cases
              </button>
              <CaseDetailReadOnly c={selectedCase} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="max-w-3xl mx-auto mb-5">
                <SearchInput
                  value={caseSearch}
                  onChange={setCaseSearch}
                  placeholder="Search your cases by student, ID, case number or offense…"
                  resultCount={caseSearch ? paged.totalElements : undefined}
                  className="card px-3.5 py-2.5"
                />
              </div>
              {paged.loading && myCases.length === 0 ? (
                <p className="text-center py-16 text-[13px] text-ink-400">Loading your cases…</p>
              ) : paged.error ? (
                <div className="max-w-3xl mx-auto flex items-center gap-2.5 text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <p className="text-[13px]">{paged.error}</p>
                </div>
              ) : myCases.length === 0 ? (
                <div className="max-w-3xl mx-auto card px-6 py-14 text-center">
                  <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4">
                    {caseSearch
                      ? <SearchX size={20} className="text-ink-400" />
                      : <FilePlus size={20} className="text-ink-400" />}
                  </div>
                  {caseSearch ? (
                    <>
                      <p className="text-sm font-semibold text-ink-800">No cases match "{caseSearch}".</p>
                      <p className="text-[13px] text-ink-500 mt-1">Try a student name, ID, case number or offense.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-ink-800">No cases reported yet.</p>
                      <p className="text-[13px] text-ink-500 mt-1">Use "Report New Incident" to submit a case.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-3">
                  {myCases.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCase(c)}
                      className="card card-interactive w-full p-5 text-left group hover:border-brand-300"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-[11px] font-mono tabular text-ink-400">{c.id}</span>
                            <StatusBadge status={c.status} />
                          </div>
                          <p className="text-sm text-ink-900">
                            <span className="font-semibold">{c.studentName}</span>
                            <span className="text-ink-400"> — </span>
                            <span className="text-ink-600">{c.offenseType}</span>
                          </p>
                          <p className="text-[12px] font-tight text-ink-400 mt-1 tabular">Reported {c.reportDate}</p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5
                                     transition-all duration-[var(--dur)] ease-[var(--ease-out)] mt-1 shrink-0"
                        />
                      </div>
                    </button>
                  ))}
                  <div className="card overflow-hidden">
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
    <div className="max-w-3xl mx-auto space-y-4 rise">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <p className="text-[11px] font-mono tabular text-ink-400 mb-1.5">{c.id}</p>
            <h2 className="display-lg text-ink-900 truncate">{c.studentName}</h2>
            <p className="text-[13px] text-ink-500 mt-0.5">
              Student ID <span className="font-mono tabular text-ink-700">{c.studentId}</span>
            </p>
          </div>
          <div className="shrink-0"><StatusBadge status={c.status} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--hairline)] pt-5">
          <div>
            <p className="eyebrow mb-1.5">Offense</p>
            <p className="text-sm text-ink-900">{c.offenseType}</p>
          </div>
          <div>
            <p className="eyebrow mb-1.5">Reported</p>
            <p className="text-sm text-ink-900 tabular">{c.reportDate}</p>
          </div>
          {c.decision && (
            <div>
              <p className="eyebrow mb-1.5">Decision</p>
              <StatusBadge status={c.decision} />
            </div>
          )}
          <div>
            <p className="eyebrow mb-1.5">Registration</p>
            <StatusBadge status={c.registrationStatus} />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <p className="eyebrow mb-2">Description</p>
        <p className="text-sm text-ink-700 leading-relaxed">{c.description}</p>
        <p className="eyebrow mt-6 mb-2">Evidence Submitted</p>
        <p className="text-sm text-ink-700 leading-relaxed">{c.evidence}</p>
        <EvidenceGallery files={c.evidenceFiles} />
      </div>

      <div className="card p-6">
        <p className="eyebrow mb-4">Case Timeline</p>
        <div className="space-y-3">
          {c.auditTrail.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-brand-600 ring-4 ring-brand-100 mt-1.5 shrink-0" />
                {i < c.auditTrail.length - 1 && <div className="w-px flex-1 bg-[var(--hairline-strong)] mt-1.5" />}
              </div>
              <div className="pb-3 min-w-0">
                <p className="text-sm text-ink-800">{entry.action}</p>
                <p className="text-[12px] font-tight text-ink-400 mt-0.5 tabular">{entry.by} · {entry.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
