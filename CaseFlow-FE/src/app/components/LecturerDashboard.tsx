import { useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus, List, ChevronRight, Paperclip, AlertCircle, Scale, ImagePlus, X } from 'lucide-react';
import { DashboardLayout, PageHeader, StatusBadge, EvidenceGallery } from './DashboardLayout';
import { DisciplinaryRulesPage } from './DisciplinaryRulesPage';
import type { AppUser, DisciplinaryCase } from './mockData';
import { reportCase, uploadEvidence, ApiError } from '../../lib/api';

interface Props {
  user: AppUser;
  cases: DisciplinaryCase[];
  setCases: React.Dispatch<React.SetStateAction<DisciplinaryCase[]>>;
  onLogout: () => void;
  onUpdateProfile: (updated: AppUser) => void;
}

// Summarized labels for AUCA's official offense catalog (Student Handbook 2018-2021, Ch. IX) —
// see the "Disciplinary Rules" page for the full descriptions and mandated measures. The three
// escalating "unauthorized political activity" tiers are collapsed into one category here since
// which tier applies depends on the student's prior record, not the incident itself.
const OFFENSE_TYPES = [
  'Undermining University Principles',
  'Criminal Arrest/Conviction',
  'Obstruction of University Operations',
  'Drunkenness on Campus',
  'Possession of Alcohol or Tobacco',
  'Drug Use or Possession',
  'Possession of Weapons',
  'Tampering with Fire Safety Equipment',
  'Insubordination',
  'Property Damage / Assault',
  'Indecent Public Assault',
  'Sexual Harassment',
  'Incitement to Riot/Strike',
  'Unauthorized Political Activity',
  'Misrepresenting University Image',
  'Academic Dishonesty (Cheating/Plagiarism)',
  'Other',
];

const navItems = [
  { id: 'report', label: 'Report New Incident', icon: <FilePlus size={16} /> },
  { id: 'mycases', label: 'My Reported Cases', icon: <List size={16} /> },
  { id: 'rules', label: 'Disciplinary Rules', icon: <Scale size={16} /> },
];

export function LecturerDashboard({ user, cases, setCases, onLogout, onUpdateProfile }: Props) {
  const [activeNav, setActiveNav] = useState('report');
  const [form, setForm] = useState({
    studentName: '',
    studentId: '',
    offenseType: '',
    description: '',
    evidence: '',
  });
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [selectedCase, setSelectedCase] = useState<DisciplinaryCase | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myCases = cases.filter(c => c.reportedBy === user.name);

  const previewUrls = useMemo(() => evidenceFiles.map(f => URL.createObjectURL(f)), [evidenceFiles]);
  useEffect(() => {
    return () => previewUrls.forEach(url => URL.revokeObjectURL(url));
  }, [previewUrls]);

  function addEvidenceFiles(fileList: FileList | null) {
    if (!fileList) return;
    setEvidenceFiles(prev => [...prev, ...Array.from(fileList)]);
  }

  function removeEvidenceFile(index: number) {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
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
      if (evidenceFiles.length > 0) {
        try {
          newCase = await uploadEvidence(newCase.id, evidenceFiles, user.name);
        } catch (uploadErr) {
          setSubmitError(
            uploadErr instanceof ApiError
              ? `Case ${newCase.id} was created, but the evidence photos failed to upload: ${uploadErr.message}`
              : `Case ${newCase.id} was created, but the evidence photos failed to upload.`
          );
        }
      }
      setCases(prev => [newCase, ...prev]);
      setSubmitted(true);
      setForm({ studentName: '', studentId: '', offenseType: '', description: '', evidence: '' });
      setEvidenceFiles([]);
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to submit the report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const myCaseBadge = myCases.length;

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
              {submitError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle size={18} className="text-red-600 shrink-0" />
                  <p className="text-sm">{submitError}</p>
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058B8] focus:border-transparent"
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058B8] focus:border-transparent"
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058B8] focus:border-transparent bg-white"
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058B8] focus:border-transparent resize-none"
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0058B8] focus:border-transparent resize-none"
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
                        className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-[#0058B8]/40 hover:text-[#0058B8] transition-colors"
                      >
                        <ImagePlus size={15} /> Upload one or more photos
                      </button>
                      {evidenceFiles.length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-3">
                          {evidenceFiles.map((file, i) => (
                            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                              <img src={previewUrls[i]} alt={file.name} className="w-full h-full object-cover" />
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
                    className="w-full bg-[#0058B8] hover:bg-[#004590] disabled:opacity-60 text-white rounded-xl py-3 text-sm font-medium transition-colors"
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
            subtitle={`${myCases.length} case${myCases.length !== 1 ? 's' : ''} submitted by you`}
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
              {myCases.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <FilePlus size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No cases reported yet.</p>
                  <p className="text-xs mt-1">Use "Report New Incident" to submit a case.</p>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-3">
                  {myCases.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCase(c)}
                      className="w-full bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-[#0058B8]/40 hover:shadow-sm transition-all group"
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
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-[#0058B8] transition-colors mt-1 shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeNav === 'rules' && <DisciplinaryRulesPage />}
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
                <div className="w-2 h-2 rounded-full bg-[#0058B8] mt-1.5 shrink-0" />
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
