import { useState } from 'react';
import { Eye, MessageSquare, CheckCircle, Clock, AlertCircle, FileText, Scale, ShieldCheck, Download, ChevronRight } from 'lucide-react';
import { DashboardLayout, PageHeader, StatusBadge, EvidenceGallery } from './DashboardLayout';
import { DisciplinaryRulesPage } from './DisciplinaryRulesPage';
import type { AppUser, CaseStatus } from './mockData';
import { submitAppeal as apiSubmitAppeal, downloadClearanceCertificate } from '../../lib/api';
import { usePagedCases } from '../../lib/usePagedCases';
import { notifyError, notifySuccess } from '../../lib/toast';

interface Props {
  user: AppUser;
  onLogout: () => void;
  onUpdateProfile: (updated: AppUser) => void;
}

const LIFECYCLE_STEPS: CaseStatus[] = ['Reported', 'Under Review', 'Decided', 'Resolved'];

function getStepIndex(status: CaseStatus): number {
  if (status === 'Under Appeal') return 2;
  return LIFECYCLE_STEPS.indexOf(status);
}

const stepIcons = [
  <FileText size={16} />,
  <Clock size={16} />,
  <AlertCircle size={16} />,
  <CheckCircle size={16} />,
];

const stepDescriptions: Record<CaseStatus, string> = {
  'Reported': 'Your incident has been logged and the disciplinary committee has been notified.',
  'Under Review': 'The committee is actively reviewing your case. You will be notified when a decision is reached.',
  'Decided': 'The committee has recorded a decision for your case. See the decision details below.',
  'Under Appeal': 'Your appeal is currently being reviewed by the disciplinary committee.',
  'Resolved': 'Your case has been fully resolved. If you were under suspension, your re-integration has been confirmed.',
};

export function StudentDashboard({ user, onLogout, onUpdateProfile }: Props) {
  const [activeNav, setActiveNav] = useState('status');
  const [appealText, setAppealText] = useState('');
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // No filter needed: the backend scopes STUDENT callers to their own cases. Newest first, so the
  // selection below is deterministic — the old `cases.find(...)` returned whichever case happened to
  // come back first, so a student with two cases saw one of them arbitrarily and could never reach the
  // other.
  const paged = usePagedCases({}, { size: 20, sort: 'reportDate,desc' });
  const myCases = paged.items;
  const myCase = myCases.find(c => c.id === selectedCaseId) ?? (myCases.length > 0 ? myCases[0] : undefined);
  const hasMultiple = paged.totalElements > 1;
  const isCleared = !!myCase && (myCase.decision === 'Cleared' || myCase.appealStatus === 'Overturned');

  async function handleDownloadCertificate() {
    if (!myCase) return;
    setDownloadingCert(true);
    try {
      await downloadClearanceCertificate(myCase.id);
      notifySuccess('Clearance certificate downloaded.');
    } catch (err) {
      notifyError(err, 'Unable to download certificate. Please try again.');
    } finally {
      setDownloadingCert(false);
    }
  }

  const navItems = [
    { id: 'status', label: 'My Case Status', icon: <Eye size={16} /> },
    { id: 'appeal', label: 'Submit Appeal', icon: <MessageSquare size={16} /> },
    { id: 'rules', label: 'Disciplinary Rules', icon: <Scale size={16} /> },
  ];

  async function submitAppeal(e: React.FormEvent) {
    e.preventDefault();
    if (!myCase || !appealText.trim()) return;
    setSubmitting(true);
    try {
      const updated = await apiSubmitAppeal(myCase.id, appealText);
      paged.replaceItem(updated);
      setAppealSubmitted(true);
      setAppealText('');
      notifySuccess('Appeal submitted.', 'The committee will review it and notify you by email.');
    } catch (err) {
      notifyError(err, 'Unable to submit appeal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout user={user} onLogout={onLogout} onUpdateProfile={onUpdateProfile} navItems={navItems} activeNav={activeNav} onNavChange={setActiveNav}>
      {activeNav === 'status' && (
        <>
          <PageHeader
            title="My Case Status"
            subtitle={myCase ? `Case Reference: ${myCase.id}` : 'No active disciplinary case found'}
          />
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            {paged.loading && myCases.length === 0 ? (
              <p className="text-center py-16 text-sm text-gray-400">Loading your case…</p>
            ) : paged.error ? (
              <div className="max-w-lg mx-auto flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="shrink-0" />
                <p className="text-sm">{paged.error}</p>
              </div>
            ) : !myCase ? (
              <div className="max-w-lg mx-auto text-center py-16">
                <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
                <h2 className="text-lg text-gray-900 mb-2">No Active Cases</h2>
                <p className="text-sm text-gray-500">You have no disciplinary cases on record. If you believe a case exists and is not shown, please contact Student Affairs.</p>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-5">
                {/* Only rendered when there's a choice to make — one case stays a single-case view. */}
                {hasMultiple && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Your Cases ({paged.totalElements})
                    </p>
                    <div className="space-y-2">
                      {myCases.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCaseId(c.id)}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                            c.id === myCase.id
                              ? 'border-[#1D3A5F]/40 bg-[#1D3A5F]/[0.04]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-gray-400">{c.id}</p>
                            <p className="text-sm text-gray-800 truncate">{c.offenseType}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Reported {c.reportDate}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={c.status} />
                            <ChevronRight size={14} className="text-gray-300" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current status banner */}
                <div className={`rounded-2xl p-5 border ${
                  myCase.status === 'Resolved' ? 'bg-green-50 border-green-200' :
                  myCase.status === 'Decided' && myCase.decision === 'Semester Suspension' ? 'bg-red-50 border-red-200' :
                  myCase.status === 'Under Appeal' ? 'bg-purple-50 border-purple-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Current Status</p>
                    <StatusBadge status={myCase.status} />
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{stepDescriptions[myCase.status]}</p>
                </div>

                {/* Clearance banner */}
                {isCleared && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck size={22} className="text-green-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-800 mb-1">You've been cleared of these charges</p>
                        <p className="text-sm text-green-700 mb-3">
                          {myCase.decision === 'Cleared'
                            ? 'The committee reviewed your case and found no basis for disciplinary action.'
                            : 'Your appeal was successful and the original decision was overturned.'}
                          {' '}You can download an official certificate confirming this for your records.
                        </p>
                        <button type="button" onClick={handleDownloadCertificate} disabled={downloadingCert}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
                          <Download size={14} /> {downloadingCert ? 'Preparing…' : 'Download Clearance Certificate'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress timeline */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-6">Case Progress</p>
                  <div className="relative overflow-x-auto pb-1">
                    <div className="min-w-[280px]">
                      {/* Progress line */}
                      <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0" />
                      <div
                        className="absolute top-4 left-4 h-0.5 z-0 transition-all duration-500"
                        style={{ width: `${(getStepIndex(myCase.status) / (LIFECYCLE_STEPS.length - 1)) * 100}%`, backgroundColor: '#1D3A5F' }}
                      />
                      <div className="relative z-10 flex justify-between">
                        {LIFECYCLE_STEPS.map((step, i) => {
                          const currentStep = getStepIndex(myCase.status);
                          const isDone = i < currentStep;
                          const isActive = i === currentStep;
                          return (
                            <div key={step} className="flex flex-col items-center gap-2" style={{ width: '25%' }}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                                isDone ? 'text-white' :
                                isActive ? 'bg-white' :
                                'bg-white border-gray-300 text-gray-400'
                              }`} style={isDone ? { backgroundColor: '#1D3A5F', borderColor: '#1D3A5F' } : isActive ? { borderColor: '#1D3A5F', color: '#1D3A5F' } : {}}>
                                {isDone ? <CheckCircle size={14} /> : stepIcons[i]}
                              </div>
                              <p className={`text-xs font-medium text-center leading-tight ${isActive ? 'text-[#1D3A5F]' : isDone ? 'text-gray-700' : 'text-gray-400'}`}>{step}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {myCase.status === 'Under Appeal' && (
                    <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800 text-center">
                      Your case is currently under appeal review, between the "Decided" and "Resolved" stages.
                    </div>
                  )}
                </div>

                {/* Case details */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Case Information</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">Case Reference</span>
                      <span className="font-mono text-gray-700">{myCase.id}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">Offense Type</span>
                      <span className="text-gray-700">{myCase.offenseType}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">Reported By</span>
                      <span className="text-gray-700">{myCase.reportedBy}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">Report Date</span>
                      <span className="text-gray-700">{myCase.reportDate}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">Registration Status</span>
                      <StatusBadge status={myCase.registrationStatus} />
                    </div>
                    {myCase.decision && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">Committee Decision</span>
                        <StatusBadge status={myCase.decision} />
                      </div>
                    )}
                    {myCase.decisionDate && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">Decision Date</span>
                        <span className="text-gray-700">{myCase.decisionDate}</span>
                      </div>
                    )}
                    {myCase.suspensionStart && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">Suspension Period</span>
                        <span className="text-gray-700">{myCase.suspensionStart} → {myCase.suspensionEnd}</span>
                      </div>
                    )}
                    {myCase.appealSubmitted && (
                      <div className="flex justify-between py-2">
                        <span className="text-gray-500">Appeal Status</span>
                        <StatusBadge status={myCase.appealStatus || 'Pending'} />
                      </div>
                    )}
                  </div>
                </div>

                {/* The allegation itself. Students previously saw only a status tracker and a metadata
                    summary — never the description, the evidence, or the audit trail — while the
                    "Your Rights" card below promised the right to see the evidence against them. */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What Was Reported</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{myCase.description}</p>

                  {myCase.evidence && (
                    <div className="mt-5 pt-5 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Evidence Described</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{myCase.evidence}</p>
                    </div>
                  )}

                  {myCase.evidenceFiles.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Attached Evidence ({myCase.evidenceFiles.length})
                      </p>
                      <EvidenceGallery files={myCase.evidenceFiles} />
                    </div>
                  )}
                </div>

                {/* Full history of everything that has happened on the case. */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Case History</p>
                  {myCase.auditTrail.length === 0 ? (
                    <p className="text-sm text-gray-400">Nothing recorded yet.</p>
                  ) : (
                    <div className="space-y-0">
                      {myCase.auditTrail.map((entry, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: '#1D3A5F' }} />
                            {i < myCase.auditTrail.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                          </div>
                          <div className="pb-4 min-w-0">
                            <p className="text-sm text-gray-800">{entry.action}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{entry.by} · {entry.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2 pt-3 border-t border-gray-100">
                    The committee's internal deliberation notes are not shown here.
                  </p>
                </div>

                {/* Rights notice */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Rights</p>
                  <ul className="text-xs text-gray-600 space-y-1.5">
                    <li>• You have the right to know the charges against you and to see the evidence.</li>
                    <li>• You may submit a written statement to the committee at any time during the review.</li>
                    <li>• If a decision is made, you have the right to appeal within 14 days of notification.</li>
                    <li>• You may contact the Student Affairs office for guidance on the process.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeNav === 'appeal' && (
        <>
          <PageHeader title="Submit Appeal" subtitle="Contest a disciplinary decision through the formal appeals process" />
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="max-w-2xl mx-auto">
              {!myCase ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-sm">No case found to appeal.</p>
                </div>
              ) : myCase.status === 'Reported' || myCase.status === 'Under Review' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                  <AlertCircle size={32} className="text-amber-500 mx-auto mb-3" />
                  <p className="text-sm text-amber-800">Appeals can only be submitted after the committee has recorded a decision on your case.</p>
                  <p className="text-xs text-amber-700 mt-2">Your case is currently: <strong>{myCase.status}</strong></p>
                </div>
              ) : myCase.appealSubmitted ? (
                <div className="space-y-5">
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle size={20} className="text-green-600" />
                      <p className="text-sm font-medium text-green-800">Appeal Successfully Submitted</p>
                    </div>
                    <p className="text-sm text-green-700">Your appeal has been received and will be reviewed by the disciplinary committee. You will be notified of the outcome.</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Appeal Statement</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{myCase.appealText}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-sm text-gray-500">Appeal Status:</span>
                      <StatusBadge status={myCase.appealStatus || 'Pending'} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Decision Being Appealed</p>
                    <div className="flex items-center gap-3 mt-3">
                      {myCase.decision && <StatusBadge status={myCase.decision} />}
                      <span className="text-sm text-gray-500">recorded on {myCase.decisionDate}</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs text-blue-800 leading-relaxed">
                      <strong>Before submitting:</strong> Your appeal statement should explain clearly why you believe the decision is incorrect or the sanction is disproportionate. Include any new information or evidence not previously considered. Appeals are reviewed by the full committee.
                    </p>
                  </div>

                  {appealSubmitted && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-600" />
                      Appeal submitted successfully. Your case status has been updated.
                    </div>
                  )}

                  <form onSubmit={submitAppeal} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-2">Appeal Statement <span className="text-red-500">*</span></label>
                      <textarea
                        required
                        rows={8}
                        value={appealText}
                        onChange={e => setAppealText(e.target.value)}
                        placeholder="Clearly explain the grounds for your appeal. Describe why you believe the decision or sanction is incorrect, and include any relevant information not previously considered by the committee..."
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3A5F] resize-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">{appealText.length} characters</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs text-amber-800">By submitting, you confirm this is your genuine appeal and that the information provided is truthful.</p>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || !appealText.trim()}
                      className="w-full bg-[#1D3A5F] hover:bg-[#162d4a] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl py-3 text-sm font-medium transition-colors"
                    >
                      {submitting ? 'Submitting…' : 'Submit Appeal'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeNav === 'rules' && <DisciplinaryRulesPage />}
    </DashboardLayout>
  );
}

