import { useState } from 'react';
import { Inbox, MessageSquare, CheckCircle, Search, UserCheck, ChevronRight, Send, AlertTriangle, Scale } from 'lucide-react';
import { DashboardLayout, PageHeader, StatusBadge, EvidenceGallery } from './DashboardLayout';
import { DisciplinaryRulesPage } from './DisciplinaryRulesPage';
import type { AppUser, DisciplinaryCase, DecisionType } from './mockData';
import {
  addCaseNote,
  recordDecision as apiRecordDecision,
  resolveAppeal as apiResolveAppeal,
  approveReintegration as apiApproveReintegration,
  ApiError,
} from '../../lib/api';

interface Props {
  user: AppUser;
  cases: DisciplinaryCase[];
  setCases: React.Dispatch<React.SetStateAction<DisciplinaryCase[]>>;
  onLogout: () => void;
  onUpdateProfile: (updated: AppUser) => void;
}

const DECISIONS: DecisionType[] = ['Warning', 'Probation', 'Semester Suspension', 'Expulsion', 'Cleared'];

export function CommitteeDashboard({ user, cases, setCases, onLogout, onUpdateProfile }: Props) {
  const [activeNav, setActiveNav] = useState('queue');
  const [selectedCase, setSelectedCase] = useState<DisciplinaryCase | null>(null);
  const [noteText, setNoteText] = useState('');
  const [decision, setDecision] = useState<DecisionType | ''>('');
  const [suspStart, setSuspStart] = useState('');
  const [suspEnd, setSuspEnd] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<DisciplinaryCase[] | null>(null);
  const [appealAction, setAppealAction] = useState<'Upheld' | 'Overturned' | ''>('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const queueCases = cases.filter(c => c.status === 'Reported' || c.status === 'Under Review');
  const appealCases = cases.filter(c => c.status === 'Under Appeal');

  function applyUpdatedCase(updated: DisciplinaryCase) {
    setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelectedCase(prev => prev && prev.id === updated.id ? updated : prev);
    setSearchResult(prev => prev ? prev.map(c => c.id === updated.id ? updated : c) : prev);
  }

  async function addNote() {
    if (!noteText.trim() || !selectedCase) return;
    setActionError('');
    setBusy(true);
    try {
      const updated = await addCaseNote(selectedCase.id, user.name, noteText);
      applyUpdatedCase(updated);
      setNoteText('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to add note. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function recordDecision() {
    if (!decision || !selectedCase) return;
    setActionError('');
    setBusy(true);
    try {
      const updated = await apiRecordDecision(selectedCase.id, {
        decision,
        suspensionStart: suspStart || undefined,
        suspensionEnd: suspEnd || undefined,
        by: user.name,
      });
      applyUpdatedCase(updated);
      setDecision('');
      setSuspStart('');
      setSuspEnd('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to record decision. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resolveAppeal() {
    if (!appealAction || !selectedCase) return;
    setActionError('');
    setBusy(true);
    try {
      const updated = await apiResolveAppeal(selectedCase.id, appealAction, user.name);
      applyUpdatedCase(updated);
      setAppealAction('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to resolve appeal. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function approveReintegration(caseId: string) {
    setActionError('');
    setBusy(true);
    try {
      const updated = await apiApproveReintegration(caseId, user.name);
      applyUpdatedCase(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to approve re-integration. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleSearch() {
    const results = cases.filter(c => c.studentId === searchId || c.studentName.toLowerCase().includes(searchId.toLowerCase()));
    setSearchResult(results);
  }

  const navItems = [
    { id: 'queue', label: 'Cases Queue', icon: <Inbox size={16} />, badge: queueCases.length },
    { id: 'appeals', label: 'Appeals Review', icon: <MessageSquare size={16} />, badge: appealCases.length },
    { id: 'all', label: 'All Cases', icon: <CheckCircle size={16} /> },
    { id: 'reintegration', label: 'Re-integration', icon: <UserCheck size={16} /> },
    { id: 'rules', label: 'Disciplinary Rules', icon: <Scale size={16} /> },
  ];

  return (
    <DashboardLayout user={user} onLogout={onLogout} onUpdateProfile={onUpdateProfile} navItems={navItems} activeNav={activeNav} onNavChange={id => { setActiveNav(id); setSelectedCase(null); }}>
      {(activeNav === 'queue' || activeNav === 'appeals' || activeNav === 'all') && (
        <div className="flex flex-1 overflow-hidden">
          {/* Cases list panel — hidden on mobile when a case is open */}
          <div className={`${selectedCase ? 'hidden lg:flex' : 'flex'} w-full lg:w-72 border-r border-gray-200 bg-white flex-col shrink-0`}>
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {activeNav === 'queue' ? 'Pending Review' : activeNav === 'appeals' ? 'Under Appeal' : 'All Cases'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(activeNav === 'queue' ? queueCases : activeNav === 'appeals' ? appealCases : cases).map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCase(c)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedCase?.id === c.id ? 'bg-blue-50 border-l-2 border-l-[#1D3A5F]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-gray-400 mb-1">{c.id}</p>
                      <p className="text-sm text-gray-900 truncate">{c.studentName}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{c.offenseType}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{c.reportDate}</p>
                </button>
              ))}
              {(activeNav === 'queue' ? queueCases : activeNav === 'appeals' ? appealCases : cases).length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">No cases in this view.</div>
              )}
            </div>
          </div>

          {/* Case detail panel — full screen on mobile when open */}
          <div className={`${selectedCase ? 'flex' : 'hidden lg:flex'} flex-1 overflow-y-auto bg-gray-50 flex-col`}>
            {selectedCase ? (
              <div className="lg:hidden px-4 pt-4">
                <button onClick={() => setSelectedCase(null)} className="text-sm text-gray-500 hover:text-gray-900 mb-2 transition-colors">← Back to cases</button>
              </div>
            ) : null}
            {selectedCase ? (
              <CommitteeCaseDetail
                c={selectedCase}
                noteText={noteText}
                setNoteText={setNoteText}
                onAddNote={addNote}
                decision={decision}
                setDecision={setDecision}
                suspStart={suspStart}
                setSuspStart={setSuspStart}
                suspEnd={suspEnd}
                setSuspEnd={setSuspEnd}
                onRecordDecision={recordDecision}
                appealAction={appealAction}
                setAppealAction={setAppealAction}
                onResolveAppeal={resolveAppeal}
                busy={busy}
                actionError={actionError}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <ChevronRight size={40} className="mx-auto mb-3 opacity-20 -rotate-90" />
                  <p className="text-sm">Select a case to review</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeNav === 'reintegration' && (
        <>
          <PageHeader title="Re-integration Verification" subtitle="Confirm a student has served their suspension before clearing them to re-register" />
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="max-w-2xl mx-auto">
              {actionError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                  <AlertTriangle size={15} className="shrink-0" />
                  <p className="text-sm">{actionError}</p>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                <p className="text-sm text-gray-700 mb-4">Search by student ID number or name to retrieve their disciplinary record.</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={searchId}
                    onChange={e => setSearchId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Student ID or name..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3A5F]"
                  />
                  <button onClick={handleSearch} className="flex items-center gap-2 bg-[#1D3A5F] hover:bg-[#162d4a] text-white px-4 py-2 rounded-lg text-sm transition-colors">
                    <Search size={14} /> Search
                  </button>
                </div>
              </div>

              {searchResult !== null && (
                searchResult.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
                    <p className="text-sm">No disciplinary records found for this student.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {searchResult.map(c => (
                      <ReintegrationCard key={c.id} c={c} onApprove={() => approveReintegration(c.id)} busy={busy} />
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}

      {activeNav === 'rules' && <DisciplinaryRulesPage />}
    </DashboardLayout>
  );
}

function CommitteeCaseDetail({
  c, noteText, setNoteText, onAddNote,
  decision, setDecision, suspStart, setSuspStart, suspEnd, setSuspEnd, onRecordDecision,
  appealAction, setAppealAction, onResolveAppeal, busy, actionError
}: {
  c: DisciplinaryCase;
  noteText: string; setNoteText: (v: string) => void; onAddNote: () => void;
  decision: DecisionType | ''; setDecision: (v: DecisionType | '') => void;
  suspStart: string; setSuspStart: (v: string) => void;
  suspEnd: string; setSuspEnd: (v: string) => void;
  onRecordDecision: () => void;
  appealAction: 'Upheld' | 'Overturned' | ''; setAppealAction: (v: 'Upheld' | 'Overturned' | '') => void;
  onResolveAppeal: () => void;
  busy: boolean; actionError: string;
}) {
  const needsSuspension = decision === 'Semester Suspension' || decision === 'Expulsion';
  const canDecide = c.status === 'Under Review' || c.status === 'Reported';
  const canAppeal = c.status === 'Under Appeal';

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      {actionError && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="shrink-0" />
          <p className="text-sm">{actionError}</p>
        </div>
      )}
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-mono text-gray-400 mb-1">{c.id}</p>
            <h2 className="text-lg text-gray-900">{c.studentName}</h2>
            <p className="text-sm text-gray-500">Student ID: {c.studentId} · Reported by {c.reportedBy}</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <StatusBadge status={c.status} />
            <StatusBadge status={c.registrationStatus} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-4">
          <div><span className="text-gray-500">Offense:</span> <span className="text-gray-900 ml-1">{c.offenseType}</span></div>
          <div><span className="text-gray-500">Reported:</span> <span className="text-gray-900 ml-1">{c.reportDate}</span></div>
          {c.decision && <div><span className="text-gray-500">Decision:</span> <span className="ml-1"><StatusBadge status={c.decision} /></span></div>}
          {c.decisionDate && <div><span className="text-gray-500">Decision Date:</span> <span className="text-gray-900 ml-1">{c.decisionDate}</span></div>}
          {c.suspensionStart && <div><span className="text-gray-500">Suspension:</span> <span className="text-gray-900 ml-1">{c.suspensionStart} to {c.suspensionEnd}</span></div>}
        </div>
      </div>

      {/* Description & Evidence */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Incident Description</p>
        <p className="text-sm text-gray-700 leading-relaxed">{c.description}</p>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Evidence on File</p>
        <p className="text-sm text-gray-700">{c.evidence}</p>
        <EvidenceGallery files={c.evidenceFiles} />
      </div>

      {/* Appeal text if present */}
      {c.appealSubmitted && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Student Appeal Statement
          </p>
          <p className="text-sm text-purple-900 leading-relaxed">{c.appealText}</p>
          {c.appealStatus && <div className="mt-2"><StatusBadge status={c.appealStatus} /></div>}
        </div>
      )}

      {/* Deliberation notes */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Committee Deliberation Notes</p>
        {c.notes.length === 0 && <p className="text-sm text-gray-400 mb-4">No notes yet. Be the first to add a deliberation note.</p>}
        <div className="space-y-3 mb-4">
          {c.notes.map(n => (
            <div key={n.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">{n.author}</span>
                <span className="text-xs text-gray-400">{n.timestamp}</span>
              </div>
              <p className="text-sm text-gray-700">{n.text}</p>
            </div>
          ))}
        </div>
        {(canDecide || canAppeal) && (
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a deliberation note..."
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3A5F] resize-none"
            />
            <button
              onClick={onAddNote}
              disabled={busy || !noteText.trim()}
              className="flex items-center gap-1.5 bg-[#1D3A5F] hover:bg-[#162d4a] disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 rounded-xl text-sm transition-colors self-end py-2"
            >
              <Send size={13} /> Add
            </button>
          </div>
        )}
      </div>

      {/* Record decision */}
      {canDecide && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Record Committee Decision</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">Decision <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DECISIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDecision(d)}
                    className={`py-2 px-3 rounded-xl border text-sm transition-all ${
                      decision === d ? 'border-[#1D3A5F] bg-[#1D3A5F]/5 text-[#1D3A5F]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {needsSuspension && (
              <div className="grid grid-cols-2 gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div>
                  <label className="block text-sm text-amber-800 mb-1.5">Suspension Start Date</label>
                  <input type="date" value={suspStart} onChange={e => setSuspStart(e.target.value)} className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-sm text-amber-800 mb-1.5">Suspension End Date</label>
                  <input type="date" value={suspEnd} onChange={e => setSuspEnd(e.target.value)} className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
            )}
            <button
              onClick={onRecordDecision}
              disabled={busy || !decision || (needsSuspension && (!suspStart || !suspEnd))}
              className="w-full bg-[#1D3A5F] hover:bg-[#162d4a] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              Record Decision & Notify Student
            </button>
          </div>
        </div>
      )}

      {/* Appeal resolution */}
      {canAppeal && c.appealStatus === 'Pending' && (
        <div className="bg-white rounded-2xl border border-purple-200 p-6">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-4">Resolve Appeal</p>
          <div className="flex gap-3">
            <button
              onClick={() => setAppealAction('Overturned')}
              className={`flex-1 py-2.5 rounded-xl border text-sm transition-all ${appealAction === 'Overturned' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              Overturn Decision
            </button>
            <button
              onClick={() => setAppealAction('Upheld')}
              className={`flex-1 py-2.5 rounded-xl border text-sm transition-all ${appealAction === 'Upheld' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              Uphold Original Decision
            </button>
          </div>
          {appealAction && (
            <button onClick={onResolveAppeal} disabled={busy} className="w-full mt-3 bg-purple-700 hover:bg-purple-800 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
              Confirm Appeal Resolution: {appealAction}
            </button>
          )}
        </div>
      )}

      {/* Audit trail */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Audit Trail</p>
        <div className="space-y-3">
          {c.auditTrail.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-[#1D3A5F]/60 mt-1.5 shrink-0" />
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

function ReintegrationCard({ c, onApprove, busy }: { c: DisciplinaryCase; onApprove: () => void; busy: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const suspensionEnded = c.suspensionEnd ? c.suspensionEnd <= today : false;
  const canReintegrate = c.status === 'Decided' && c.decision === 'Semester Suspension' && suspensionEnded;
  const isResolved = c.status === 'Resolved';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-mono text-gray-400 mb-1">{c.id}</p>
          <p className="text-base text-gray-900">{c.studentName}</p>
          <p className="text-sm text-gray-500">Student ID: {c.studentId}</p>
        </div>
        <StatusBadge status={c.registrationStatus} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div><span className="text-gray-500">Offense:</span> <span className="text-gray-900 ml-1">{c.offenseType}</span></div>
        <div><span className="text-gray-500">Decision:</span> {c.decision ? <span className="ml-1"><StatusBadge status={c.decision} /></span> : <span className="text-gray-400 ml-1">Pending</span>}</div>
        {c.suspensionStart && <div><span className="text-gray-500">Suspension Start:</span> <span className="text-gray-900 ml-1">{c.suspensionStart}</span></div>}
        {c.suspensionEnd && <div><span className="text-gray-500">Suspension End:</span> <span className="text-gray-900 ml-1">{c.suspensionEnd}</span></div>}
        <div><span className="text-gray-500">Case Status:</span> <span className="ml-1"><StatusBadge status={c.status} /></span></div>
      </div>

      {isResolved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 flex items-center gap-2">
          <UserCheck size={14} className="text-green-600" />
          Student has been formally re-integrated. Registration is active.
        </div>
      )}
      {canReintegrate && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
            Suspension period has ended. Student may be cleared to re-register.
          </div>
          <button onClick={onApprove} disabled={busy} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
            Approve Re-integration & Restore Registration
          </button>
        </div>
      )}
      {!canReintegrate && !isResolved && c.suspensionEnd && c.suspensionEnd > today && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          Suspension period has not yet ended ({c.suspensionEnd}). Re-integration cannot be approved at this time.
        </div>
      )}
      {!c.decision && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-600">
          No decision has been recorded for this case yet.
        </div>
      )}
    </div>
  );
}
