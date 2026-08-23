import { useState } from 'react';
import { Eye, MessageSquare, CheckCircle, Clock, AlertCircle, FileText, Scale, ShieldCheck, Download, ChevronRight, Info, Inbox } from 'lucide-react';
import { DashboardLayout, PageHeader, PrimaryButton, StatusBadge, EvidenceGallery } from './DashboardLayout';
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
  <FileText size={15} />,
  <Clock size={15} />,
  <AlertCircle size={15} />,
  <CheckCircle size={15} />,
];

const stepDescriptions: Record<CaseStatus, string> = {
  'Reported': 'Your incident has been logged and the disciplinary committee has been notified.',
  'Under Review': 'The committee is actively reviewing your case. You will be notified when a decision is reached.',
  'Decided': 'The committee has recorded a decision for your case. See the decision details below.',
  'Under Appeal': 'Your appeal is currently being reviewed by the disciplinary committee.',
  'Resolved': 'Your case has been fully resolved. If you were under suspension, your re-integration has been confirmed.',
};

/** One label/value line in the case information panel. Presentation only. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[var(--hairline)] last:border-b-0">
      <span className="text-[13px] text-ink-500">{label}</span>
      <span className="text-[13px] text-ink-800 text-right">{children}</span>
    </div>
  );
}

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
              <p className="text-center py-16 text-sm text-ink-400">Loading your case…</p>
            ) : paged.error ? (
              <div className="max-w-lg mx-auto flex items-center gap-2.5 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="shrink-0" />
                <p className="text-sm">{paged.error}</p>
              </div>
            ) : !myCase ? (
              <div className="max-w-lg mx-auto text-center py-20">
                <div className="w-12 h-12 rounded-full bg-emerald-50 ring-1 ring-emerald-200/70 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={22} className="text-emerald-600" />
                </div>
                <h2 className="display-md text-ink-900 mb-1.5">No active cases</h2>
                <p className="text-[13px] text-ink-500 leading-relaxed max-w-sm mx-auto">
                  You have no disciplinary cases on record. If you believe a case exists and is not shown here,
                  please contact Student Affairs.
                </p>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-5 rise">
                {/* Only rendered when there's a choice to make — one case stays a single-case view. */}
                {hasMultiple && (
                  <div className="card p-5">
                    <p className="eyebrow mb-3">Your Cases ({paged.totalElements})</p>
                    <div className="space-y-2">
                      {myCases.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={c.id === myCase.id}
                          onClick={() => setSelectedCaseId(c.id)}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left
                                      transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                            c.id === myCase.id
                              ? 'border-brand-300 bg-brand-50 shadow-[var(--shadow-xs)]'
                              : 'border-[var(--hairline)] bg-white hover:border-[var(--hairline-strong)] hover:bg-ink-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-mono tabular text-ink-400">{c.id}</p>
                            <p className="text-[13px] text-ink-800 truncate mt-0.5">{c.offenseType}</p>
                            <p className="text-[11px] text-ink-400 tabular mt-0.5">Reported {c.reportDate}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={c.status} />
                            <ChevronRight size={14} className="text-ink-300" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current status banner */}
                <div className={`rounded-2xl p-5 border ${
                  myCase.status === 'Resolved' ? 'bg-emerald-50/70 border-emerald-200/70' :
                  myCase.status === 'Decided' && myCase.decision === 'Semester Suspension' ? 'bg-rose-50/70 border-rose-200/70' :
                  myCase.status === 'Under Appeal' ? 'bg-violet-50/70 border-violet-200/70' :
                  'bg-brand-50 border-brand-200/70'
                }`}>
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <p className="eyebrow">Current Status</p>
                    <StatusBadge status={myCase.status} />
                  </div>
                  <p className="text-[13px] text-ink-700 leading-relaxed">{stepDescriptions[myCase.status]}</p>
                </div>

                {/* Clearance banner */}
                {isCleared && (
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-5 shadow-[var(--shadow-xs)]">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <ShieldCheck size={20} className="text-emerald-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="display-md text-emerald-900 mb-1">You have been cleared</p>
                        <p className="text-[13px] text-emerald-800/90 leading-relaxed mb-4">
                          {myCase.decision === 'Cleared'
                            ? 'The committee reviewed your case and found no basis for disciplinary action.'
                            : 'Your appeal was successful and the original decision was overturned.'}
                          {' '}You can download an official certificate confirming this for your records.
                        </p>
                        <button
                          type="button"
                          onClick={handleDownloadCertificate}
                          disabled={downloadingCert}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white
                                     shadow-[var(--shadow-sm)] transition-all duration-[var(--dur)] ease-[var(--ease-out)]
                                     hover:bg-emerald-700 hover:shadow-[var(--shadow-md)] active:translate-y-px
                                     disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Download size={14} /> {downloadingCert ? 'Preparing…' : 'Download Clearance Certificate'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress timeline */}
                <div className="card p-6">
                  <p className="eyebrow mb-7">Case Progress</p>
                  <div className="overflow-x-auto pb-1">
                    <div className="relative min-w-[300px]">
                      {/* Rail spans centre-of-first to centre-of-last step (each step column is 25% wide). */}
                      <div className="absolute top-[18px] left-[12.5%] right-[12.5%] h-[3px] -translate-y-1/2 rounded-full bg-ink-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-700 transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out)]"
                          style={{ width: `${(getStepIndex(myCase.status) / (LIFECYCLE_STEPS.length - 1)) * 100}%` }}
                        />
                      </div>
                      <div className="relative flex">
                        {LIFECYCLE_STEPS.map((step, i) => {
                          const currentStep = getStepIndex(myCase.status);
                          const isDone = i < currentStep;
                          const isActive = i === currentStep;
                          return (
                            <div key={step} className="flex flex-col items-center gap-2.5 w-1/4">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2
                                               transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                                isDone ? 'bg-brand-700 border-brand-700 text-white shadow-[var(--shadow-xs)]' :
                                isActive ? 'bg-white border-brand-700 text-brand-700 ring-4 ring-brand-100' :
                                'bg-white border-ink-200 text-ink-300'
                              }`}>
                                {isDone ? <CheckCircle size={15} /> : stepIcons[i]}
                              </div>
                              <p className={`text-[11px] font-tight font-semibold text-center leading-tight tracking-[0.01em] ${
                                isActive ? 'text-brand-700' : isDone ? 'text-ink-700' : 'text-ink-400'
                              }`}>
                                {step}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {myCase.status === 'Under Appeal' && (
                    <div className="mt-6 rounded-xl border border-violet-200/70 bg-violet-50/70 px-4 py-3 text-center text-xs leading-relaxed text-violet-900">
                      Your case is currently under appeal review, between the &ldquo;Decided&rdquo; and &ldquo;Resolved&rdquo; stages.
                    </div>
                  )}
                </div>

                {/* Case details */}
                <div className="card p-6">
                  <p className="eyebrow mb-3">Case Information</p>
                  <div>
                    <DetailRow label="Case Reference">
                      <span className="font-mono tabular text-ink-700">{myCase.id}</span>
                    </DetailRow>
                    <DetailRow label="Offense Type">{myCase.offenseType}</DetailRow>
                    <DetailRow label="Reported By">{myCase.reportedBy}</DetailRow>
                    <DetailRow label="Report Date">
                      <span className="tabular">{myCase.reportDate}</span>
                    </DetailRow>
                    <DetailRow label="Registration Status">
                      <StatusBadge status={myCase.registrationStatus} />
                    </DetailRow>
                    {myCase.decision && (
                      <DetailRow label="Committee Decision">
                        <StatusBadge status={myCase.decision} />
                      </DetailRow>
                    )}
                    {myCase.decisionDate && (
                      <DetailRow label="Decision Date">
                        <span className="tabular">{myCase.decisionDate}</span>
                      </DetailRow>
                    )}
                    {myCase.suspensionStart && (
                      <DetailRow label="Suspension Period">
                        <span className="tabular">{myCase.suspensionStart} → {myCase.suspensionEnd}</span>
                      </DetailRow>
                    )}
                    {myCase.appealSubmitted && (
                      <DetailRow label="Appeal Status">
                        <StatusBadge status={myCase.appealStatus || 'Pending'} />
                      </DetailRow>
                    )}
                  </div>
                </div>

                {/* The allegation itself. Students previously saw only a status tracker and a metadata
                    summary — never the description, the evidence, or the audit trail — while the
                    "Your Rights" card below promised the right to see the evidence against them. */}
                <div className="card p-6">
                  <p className="eyebrow mb-3">What Was Reported</p>
                  <p className="text-[13px] text-ink-700 whitespace-pre-wrap leading-relaxed">{myCase.description}</p>

                  {myCase.evidence && (
                    <div className="mt-5 pt-5 border-t border-[var(--hairline)]">
                      <p className="eyebrow mb-2">Evidence Described</p>
                      <p className="text-[13px] text-ink-700 whitespace-pre-wrap leading-relaxed">{myCase.evidence}</p>
                    </div>
                  )}

                  {myCase.evidenceFiles.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-[var(--hairline)]">
                      <p className="eyebrow">
                        Attached Evidence (<span className="tabular">{myCase.evidenceFiles.length}</span>)
                      </p>
                      <EvidenceGallery files={myCase.evidenceFiles} />
                    </div>
                  )}
                </div>

                {/* Full history of everything that has happened on the case. */}
                <div className="card p-6">
                  <p className="eyebrow mb-4">Case History</p>
                  {myCase.auditTrail.length === 0 ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center shrink-0">
                        <Inbox size={20} className="text-ink-400" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-ink-700">Nothing recorded yet</p>
                        <p className="text-xs text-ink-500 mt-0.5">Each step the committee takes will appear here.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {myCase.auditTrail.map((entry, i) => (
                        <div key={i} className="flex gap-3.5">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full mt-[7px] shrink-0 bg-brand-600 ring-4 ring-brand-50" />
                            {i < myCase.auditTrail.length - 1 && (
                              <div className="w-px flex-1 bg-[var(--hairline-strong)] mt-1.5" />
                            )}
                          </div>
                          <div className="pb-5 min-w-0">
                            <p className="text-[13px] text-ink-800 leading-snug">{entry.action}</p>
                            <p className="text-[11px] text-ink-400 font-tight tabular mt-1">{entry.by} · {entry.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-ink-400 mt-2 pt-3 border-t border-[var(--hairline)] leading-relaxed">
                    The committee&rsquo;s internal deliberation notes are not shown here.
                  </p>
                </div>

                {/* Rights notice */}
                <div className="rounded-2xl border border-[var(--hairline)] bg-sand-200/70 p-5">
                  <p className="eyebrow mb-3">Your Rights</p>
                  <ul className="space-y-2 text-xs text-ink-600 leading-relaxed">
                    {[
                      'You have the right to know the charges against you and to see the evidence.',
                      'You may submit a written statement to the committee at any time during the review.',
                      'If a decision is made, you have the right to appeal within 14 days of notification.',
                      'You may contact the Student Affairs office for guidance on the process.',
                    ].map(right => (
                      <li key={right} className="flex gap-2.5">
                        <span className="mt-[7px] w-1 h-1 rounded-full bg-brand-400 shrink-0" aria-hidden="true" />
                        <span>{right}</span>
                      </li>
                    ))}
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
            <div className="max-w-2xl mx-auto rise">
              {!myCase ? (
                <div className="text-center py-20">
                  <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare size={20} className="text-ink-400" />
                  </div>
                  <p className="text-[13px] font-semibold text-ink-700">No case found to appeal</p>
                  <p className="text-xs text-ink-500 mt-1">An appeal can only be raised against a case on your record.</p>
                </div>
              ) : myCase.status === 'Reported' || myCase.status === 'Under Review' ? (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                    <Clock size={20} className="text-amber-700" />
                  </div>
                  <p className="display-md text-amber-900 mb-1.5">Not open for appeal yet</p>
                  <p className="text-[13px] text-amber-800/90 leading-relaxed max-w-md mx-auto">
                    Appeals can only be submitted after the committee has recorded a decision on your case.
                  </p>
                  <p className="text-xs text-amber-800/80 mt-3">
                    Your case is currently: <strong className="font-semibold">{myCase.status}</strong>
                  </p>
                </div>
              ) : myCase.appealSubmitted ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle size={18} className="text-emerald-700" />
                      </div>
                      <p className="display-md text-emerald-900">Appeal received</p>
                    </div>
                    <p className="text-[13px] text-emerald-800/90 leading-relaxed">
                      Your appeal has been received and will be reviewed by the disciplinary committee. You will be notified of the outcome.
                    </p>
                  </div>
                  <div className="card p-6">
                    <p className="eyebrow mb-3">Your Appeal Statement</p>
                    <p className="text-[13px] text-ink-700 whitespace-pre-wrap leading-relaxed">{myCase.appealText}</p>
                    <div className="mt-5 pt-4 border-t border-[var(--hairline)] flex items-center gap-2.5">
                      <span className="text-[13px] text-ink-500">Appeal Status</span>
                      <StatusBadge status={myCase.appealStatus || 'Pending'} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="card p-6">
                    <p className="eyebrow mb-3">Decision Being Appealed</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {myCase.decision && <StatusBadge status={myCase.decision} />}
                      <span className="text-[13px] text-ink-500 tabular">recorded on {myCase.decisionDate}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-brand-200/70 bg-brand-50 p-4">
                    <div className="flex gap-3">
                      <Info size={16} className="text-brand-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-brand-900/90 leading-relaxed">
                        <strong className="font-semibold">Before submitting:</strong> Your appeal statement should explain clearly why you believe the decision is incorrect or the sanction is disproportionate. Include any new information or evidence not previously considered. Appeals are reviewed by the full committee.
                      </p>
                    </div>
                  </div>

                  {appealSubmitted && (
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-4 text-[13px] text-emerald-900 flex items-center gap-2.5">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                      Appeal submitted successfully. Your case status has been updated.
                    </div>
                  )}

                  <form onSubmit={submitAppeal} className="card p-6 space-y-4">
                    <div>
                      <label htmlFor="appeal-statement" className="block text-[13px] font-medium text-ink-700 mb-2">
                        Appeal Statement <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        id="appeal-statement"
                        required
                        rows={8}
                        value={appealText}
                        onChange={e => setAppealText(e.target.value)}
                        placeholder="Clearly explain the grounds for your appeal. Describe why you believe the decision or sanction is incorrect, and include any relevant information not previously considered by the committee..."
                        className="w-full resize-none rounded-xl border border-[var(--hairline)] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed
                                   text-ink-800 placeholder-ink-400 outline-none transition-all duration-[var(--dur)] ease-[var(--ease-out)]
                                   focus:border-brand-400 focus:shadow-[var(--shadow-focus)]"
                      />
                      <p className="text-[11px] text-ink-400 font-tight tabular mt-1.5">{appealText.length} characters</p>
                    </div>
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3">
                      <p className="text-xs text-amber-900/90 leading-relaxed">
                        By submitting, you confirm this is your genuine appeal and that the information provided is truthful.
                      </p>
                    </div>
                    <PrimaryButton
                      type="submit"
                      disabled={submitting || !appealText.trim()}
                      className="w-full"
                    >
                      {submitting ? 'Submitting…' : 'Submit Appeal'}
                    </PrimaryButton>
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
