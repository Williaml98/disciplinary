import { useState } from 'react';
import { Inbox, MessageSquare, CheckCircle, Search, UserCheck, ChevronRight, Send, AlertTriangle, Scale, BarChart3, Check, ArrowLeft } from 'lucide-react';
import { DashboardLayout, PageHeader, PrimaryButton, StatusBadge, EvidenceGallery } from './DashboardLayout';
import { DisciplinaryRulesPage } from './DisciplinaryRulesPage';
import { ReportsPage } from './ReportsPage';
import type { AppUser, DisciplinaryCase, DecisionType, CaseStatus } from './mockData';
import {
  addCaseNote,
  recordDecision as apiRecordDecision,
  resolveAppeal as apiResolveAppeal,
  approveReintegration as apiApproveReintegration,
  fetchCasesPage,
} from '../../lib/api';
import { usePagedCases } from '../../lib/usePagedCases';
import { useCaseStats, useDebouncedValue } from '../../lib/hooks';
import { LoadMore } from './Pagination';
import { SearchInput } from './SearchInput';
import { StatusChanger } from './StatusChanger';
import { notifyError, notifySuccess } from '../../lib/toast';

interface Props {
  user: AppUser;
  onLogout: () => void;
  onUpdateProfile: (updated: AppUser) => void;
}

const DECISIONS: DecisionType[] = ['Warning', 'Probation', 'Semester Suspension', 'Expulsion', 'Cleared'];

/** One consistent treatment for every text control on this screen. */
const FIELD =
  'w-full rounded-xl border border-[var(--hairline)] bg-white px-3.5 py-2.5 text-[13px] text-ink-800 ' +
  'placeholder-ink-400 outline-none transition-all duration-[var(--dur)] ease-[var(--ease-out)] ' +
  'focus:border-brand-400 focus:shadow-[var(--shadow-focus)]';

export function CommitteeDashboard({ user, onLogout, onUpdateProfile }: Props) {
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
  const [searching, setSearching] = useState(false);

  const [listSearch, setListSearch] = useState('');
  const debouncedListSearch = useDebouncedValue(listSearch, 300);

  // The list follows whichever tab is open, filtered server-side, narrowed further by the search box.
  const listFilters: { status?: CaseStatus[]; search?: string } = {
    ...(activeNav === 'queue' ? { status: ['Reported', 'Under Review'] as CaseStatus[] }
      : activeNav === 'appeals' ? { status: ['Under Appeal'] as CaseStatus[] }
      : {}),
    search: debouncedListSearch || undefined,
  };
  // Append mode: this is a 288px-wide triage column, where numbered page controls don't fit and a
  // scroll-and-load list matches how it's actually worked through.
  const paged = usePagedCases(listFilters, { size: 25, mode: 'append', sort: 'reportDate,desc' });

  // Badges come from global counts, not the loaded page — otherwise they'd silently show "how many are
  // on screen" rather than "how many need attention".
  const stats = useCaseStats();
  const queueBadge = stats.data ? stats.data.reported + stats.data.underReview : 0;
  const appealBadge = stats.data?.underAppeal ?? 0;

  function applyUpdatedCase(updated: DisciplinaryCase, statusChanged = false) {
    paged.replaceItem(updated);
    setSelectedCase(prev => prev && prev.id === updated.id ? updated : prev);
    setSearchResult(prev => prev ? prev.map(c => c.id === updated.id ? updated : c) : prev);
    // replaceItem alone would leave a just-decided case sitting in a list labelled "Pending Review".
    // The reload reconciles which cases still belong in the current filter; the stats reload keeps the
    // badges honest.
    if (statusChanged) {
      paged.reload();
      stats.reload();
    }
  }

  async function addNote() {
    if (!noteText.trim() || !selectedCase) return;
    setBusy(true);
    try {
      const wasReported = selectedCase.status === 'Reported';
      const updated = await addCaseNote(selectedCase.id, user.name, noteText);
      // Adding the first note promotes Reported -> Under Review server-side.
      applyUpdatedCase(updated, wasReported);
      setNoteText('');
      // The backend promotes Reported -> Under Review on the first note; say so rather than
      // letting the badge change on its own.
      notifySuccess('Note added.', wasReported ? 'This case has moved to Under Review.' : undefined);
    } catch (err) {
      notifyError(err, 'Unable to add note. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function recordDecision() {
    if (!decision || !selectedCase) return;
    setBusy(true);
    try {
      const updated = await apiRecordDecision(selectedCase.id, {
        decision,
        suspensionStart: suspStart || undefined,
        suspensionEnd: suspEnd || undefined,
        by: user.name,
      });
      applyUpdatedCase(updated, true);
      setDecision('');
      setSuspStart('');
      setSuspEnd('');
      notifySuccess(
        `Decision recorded: ${updated.decision}.`,
        updated.status === 'Resolved'
          ? 'The case is now resolved and the student has been notified by email.'
          : 'The student has been notified by email.',
      );
    } catch (err) {
      notifyError(err, 'Unable to record decision. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resolveAppeal() {
    if (!appealAction || !selectedCase) return;
    setBusy(true);
    try {
      const updated = await apiResolveAppeal(selectedCase.id, appealAction, user.name);
      applyUpdatedCase(updated, true);
      setAppealAction('');
      notifySuccess(`Appeal ${appealAction.toLowerCase()}.`, 'The student has been notified by email.');
    } catch (err) {
      notifyError(err, 'Unable to resolve appeal. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function approveReintegration(caseId: string) {
    setBusy(true);
    try {
      const updated = await apiApproveReintegration(caseId, user.name);
      applyUpdatedCase(updated, true);
      notifySuccess(`Re-integration approved for ${updated.studentName}.`,
        'Their registration status is now Active.');
    } catch (err) {
      notifyError(err, 'Unable to approve re-integration. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSearch() {
    if (!searchId.trim()) return;
    setSearching(true);
    try {
      // Server-side now: the client no longer holds every case to filter through. The backend's
      // `search` predicate already covers student id, name, case id and offense type.
      const results = await fetchCasesPage({ search: searchId.trim(), size: 20 });
      setSearchResult(results.content);
    } catch (err) {
      notifyError(err, 'Unable to search cases. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  const navItems = [
    { id: 'queue', label: 'Cases Queue', icon: <Inbox size={16} />, badge: queueBadge },
    { id: 'appeals', label: 'Appeals Review', icon: <MessageSquare size={16} />, badge: appealBadge },
    { id: 'all', label: 'All Cases', icon: <CheckCircle size={16} /> },
    { id: 'reintegration', label: 'Re-integration', icon: <UserCheck size={16} /> },
    { id: 'rules', label: 'Disciplinary Rules', icon: <Scale size={16} /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 size={16} /> },
  ];

  return (
    <DashboardLayout user={user} onLogout={onLogout} onUpdateProfile={onUpdateProfile} navItems={navItems} activeNav={activeNav} onNavChange={id => { setActiveNav(id); setSelectedCase(null); }}>
      {(activeNav === 'queue' || activeNav === 'appeals' || activeNav === 'all') && (
        <div className="flex flex-1 overflow-hidden">
          {/* Cases list panel — hidden on mobile when a case is open */}
          <div className={`${selectedCase ? 'hidden lg:flex' : 'flex'} w-full lg:w-72 border-r border-[var(--hairline)] bg-surface flex-col shrink-0`}>
            <div className="p-4 border-b border-[var(--hairline)] space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="eyebrow">
                  {activeNav === 'queue' ? 'Pending Review' : activeNav === 'appeals' ? 'Under Appeal' : 'All Cases'}
                </p>
                <span className="text-[11px] font-tight font-semibold text-ink-400 tabular shrink-0">
                  {paged.totalElements}
                </span>
              </div>
              <SearchInput
                value={listSearch}
                onChange={setListSearch}
                placeholder="Search cases…"
                className="bg-ink-50 border border-[var(--hairline)] rounded-xl px-3 py-2"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {paged.items.map(c => {
                const active = selectedCase?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCase(c)}
                    aria-current={active ? 'true' : undefined}
                    className={`relative w-full p-4 text-left border-b border-[var(--hairline)] transition-colors duration-[var(--dur)] ease-[var(--ease-out)] ${
                      active ? 'bg-brand-50' : 'hover:bg-ink-50'
                    }`}
                  >
                    {/* Accent rail rather than a left border, so selecting a row doesn't nudge its content. */}
                    <span
                      className={`absolute left-0 top-0 bottom-0 w-[3px] bg-brand-700 transition-opacity duration-[var(--dur)] ease-[var(--ease-out)] ${
                        active ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-mono tabular text-ink-400 mb-1">{c.id}</p>
                        <p className={`text-[13px] truncate ${active ? 'font-semibold text-brand-900' : 'font-medium text-ink-900'}`}>{c.studentName}</p>
                        <p className="text-xs text-ink-500 mt-0.5 truncate">{c.offenseType}</p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-[11px] text-ink-400 mt-2 tabular">{c.reportDate}</p>
                  </button>
                );
              })}
              {paged.loading && paged.items.length === 0 && (
                <div className="p-8 text-center text-[13px] text-ink-400">Loading cases…</div>
              )}
              {paged.error && (
                <div className="p-6 text-center text-[13px] text-rose-700">{paged.error}</div>
              )}
              {!paged.loading && !paged.error && paged.items.length === 0 && (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-3">
                    <Inbox size={18} className="text-ink-400" />
                  </div>
                  <p className="text-[13px] font-semibold text-ink-700">
                    {listSearch ? 'No matching cases' : 'Nothing to review'}
                  </p>
                  <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                    {listSearch ? `Nothing matches “${listSearch}”.` : 'Cases appear here as they are reported.'}
                  </p>
                </div>
              )}
              <LoadMore
                loaded={paged.items.length}
                total={paged.totalElements}
                loading={paged.loading}
                onLoadMore={paged.loadMore}
              />
            </div>
          </div>

          {/* Case detail panel — full screen on mobile when open */}
          <div className={`${selectedCase ? 'flex' : 'hidden lg:flex'} flex-1 overflow-y-auto bg-page flex-col`}>
            {selectedCase ? (
              <div className="lg:hidden px-4 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-[13px] font-medium text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]"
                >
                  <ArrowLeft size={14} /> Back to cases
                </button>
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
                actor={user.name}
                onStatusChanged={updated => applyUpdatedCase(updated, true)}
              />
            ) : (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center max-w-xs">
                  <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4">
                    <ChevronRight size={20} className="text-ink-400" />
                  </div>
                  <p className="display-md text-ink-800">Select a case to review</p>
                  <p className="text-[13px] text-ink-500 mt-1.5 leading-relaxed">
                    Choose a case from the list to read the report, deliberate and record a decision.
                  </p>
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
            <div className="max-w-2xl mx-auto space-y-5 rise">
              <div className="card p-6">
                <p className="eyebrow mb-2">Find a student</p>
                <p className="text-[13px] text-ink-600 mb-4 leading-relaxed">
                  Search by student ID number or name to retrieve their disciplinary record.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={searchId}
                    onChange={e => setSearchId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Student ID or name…"
                    aria-label="Student ID or name"
                    className={`flex-1 ${FIELD}`}
                  />
                  <PrimaryButton
                    onClick={handleSearch}
                    disabled={searching || !searchId.trim()}
                    className="shrink-0"
                  >
                    <Search size={14} /> {searching ? 'Searching…' : 'Search'}
                  </PrimaryButton>
                </div>
              </div>

              {searchResult !== null && (
                searchResult.length === 0 ? (
                  <div className="card p-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-3">
                      <Search size={18} className="text-ink-400" />
                    </div>
                    <p className="text-[13px] font-semibold text-ink-700">No records found</p>
                    <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                      No disciplinary records match that student ID or name. Check the spelling and try again.
                    </p>
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
      {activeNav === 'reports' && <ReportsPage />}
    </DashboardLayout>
  );
}

/** Label/value pair in the case summary grid. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow mb-1">{label}</p>
      <div className="text-[13px] text-ink-800">{children}</div>
    </div>
  );
}

function CommitteeCaseDetail({
  c, noteText, setNoteText, onAddNote,
  decision, setDecision, suspStart, setSuspStart, suspEnd, setSuspEnd, onRecordDecision,
  appealAction, setAppealAction, onResolveAppeal, busy, actor, onStatusChanged
}: {
  c: DisciplinaryCase;
  noteText: string; setNoteText: (v: string) => void; onAddNote: () => void;
  decision: DecisionType | ''; setDecision: (v: DecisionType | '') => void;
  suspStart: string; setSuspStart: (v: string) => void;
  suspEnd: string; setSuspEnd: (v: string) => void;
  onRecordDecision: () => void;
  appealAction: 'Upheld' | 'Overturned' | ''; setAppealAction: (v: 'Upheld' | 'Overturned' | '') => void;
  onResolveAppeal: () => void;
  busy: boolean;
  actor: string;
  onStatusChanged: (updated: DisciplinaryCase) => void;
}) {
  const needsSuspension = decision === 'Semester Suspension' || decision === 'Expulsion';
  const canDecide = c.status === 'Under Review' || c.status === 'Reported';
  const canAppeal = c.status === 'Under Appeal';

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 rise">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <p className="text-[11px] font-mono tabular text-ink-400 mb-1.5">{c.id}</p>
            <h2 className="display-lg text-ink-900 truncate">{c.studentName}</h2>
            <p className="text-[13px] text-ink-500 mt-1">
              Student ID <span className="font-mono tabular text-ink-600">{c.studentId}</span>
              <span className="mx-1.5 text-ink-300">·</span>
              Reported by {c.reportedBy}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            <StatusBadge status={c.status} />
            <StatusBadge status={c.registrationStatus} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--hairline)] pt-5">
          <Fact label="Offense">{c.offenseType}</Fact>
          <Fact label="Reported"><span className="tabular">{c.reportDate}</span></Fact>
          {c.decision && <Fact label="Decision"><StatusBadge status={c.decision} /></Fact>}
          {c.decisionDate && <Fact label="Decision Date"><span className="tabular">{c.decisionDate}</span></Fact>}
          {c.suspensionStart && (
            <Fact label="Suspension">
              <span className="tabular">{c.suspensionStart} to {c.suspensionEnd}</span>
            </Fact>
          )}
        </div>
      </div>

      {/* Description & Evidence */}
      <div className="card p-6">
        <p className="eyebrow mb-3">Incident Description</p>
        <p className="text-sm text-ink-700 leading-relaxed">{c.description}</p>
        <div className="border-t border-[var(--hairline)] mt-5 pt-5">
          <p className="eyebrow mb-2">Evidence on File</p>
          <p className="text-sm text-ink-700 leading-relaxed">{c.evidence}</p>
          <EvidenceGallery files={c.evidenceFiles} />
        </div>
      </div>

      {/* Appeal text if present */}
      {c.appealSubmitted && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-6 shadow-[var(--shadow-xs)]">
          <p className="eyebrow text-violet-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Student Appeal Statement
          </p>
          <p className="text-sm text-violet-900 leading-relaxed">{c.appealText}</p>
          {c.appealStatus && <div className="mt-3"><StatusBadge status={c.appealStatus} /></div>}
        </div>
      )}

      {/* Deliberation notes */}
      <div className="card p-6">
        <p className="eyebrow mb-4">Committee Deliberation Notes</p>
        {c.notes.length === 0 && (
          <p className="text-[13px] text-ink-500 mb-4 leading-relaxed">
            No notes yet. Be the first to add a deliberation note.
          </p>
        )}
        <div className="space-y-3 mb-4">
          {c.notes.map(n => (
            <div key={n.id} className="rounded-xl border border-[var(--hairline)] bg-ink-50 p-4">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-[12px] font-semibold text-ink-700 truncate">{n.author}</span>
                <span className="text-[11px] font-tight text-ink-400 tabular shrink-0">{n.timestamp}</span>
              </div>
              <p className="text-[13px] text-ink-700 leading-relaxed">{n.text}</p>
            </div>
          ))}
        </div>
        {(canDecide || canAppeal) && (
          <div className="flex gap-2 items-end">
            <textarea
              rows={2}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a deliberation note…"
              aria-label="Add a deliberation note"
              className={`flex-1 resize-none leading-relaxed ${FIELD}`}
            />
            <PrimaryButton
              onClick={onAddNote}
              disabled={busy || !noteText.trim()}
              className="shrink-0"
            >
              <Send size={13} /> Add
            </PrimaryButton>
          </div>
        )}
      </div>

      {/* Record decision */}
      {canDecide && (
        <div className="card p-6">
          <p className="eyebrow mb-1">Record Committee Decision</p>
          <p className="text-[13px] text-ink-500 mb-5 leading-relaxed">
            The student is notified by email as soon as the decision is recorded.
          </p>
          <div className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-ink-700 mb-2.5">
                Decision <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {DECISIONS.map(d => {
                  const selected = decision === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDecision(d)}
                      aria-pressed={selected}
                      className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium
                                  transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                        selected
                          ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-[var(--shadow-focus)]'
                          : 'border-[var(--hairline)] bg-white text-ink-600 hover:border-[var(--hairline-strong)] hover:bg-ink-50 hover:text-ink-900'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border
                                    transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                          selected
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-ink-300 bg-white text-transparent group-hover:border-ink-400'
                        }`}
                      >
                        <Check size={11} strokeWidth={3} />
                      </span>
                      <span className="truncate">{d}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {needsSuspension && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div>
                  <label className="block text-[13px] font-medium text-amber-900 mb-1.5" htmlFor="susp-start">
                    Suspension Start Date
                  </label>
                  <input
                    id="susp-start"
                    type="date"
                    value={suspStart}
                    onChange={e => setSuspStart(e.target.value)}
                    className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-[13px] text-ink-800 tabular outline-none transition-all duration-[var(--dur)] ease-[var(--ease-out)] focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(217,119,6,0.14)]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-amber-900 mb-1.5" htmlFor="susp-end">
                    Suspension End Date
                  </label>
                  <input
                    id="susp-end"
                    type="date"
                    value={suspEnd}
                    onChange={e => setSuspEnd(e.target.value)}
                    className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-[13px] text-ink-800 tabular outline-none transition-all duration-[var(--dur)] ease-[var(--ease-out)] focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(217,119,6,0.14)]"
                  />
                </div>
              </div>
            )}
            <PrimaryButton
              onClick={onRecordDecision}
              disabled={busy || !decision || (needsSuspension && (!suspStart || !suspEnd))}
              className="w-full"
            >
              Record Decision & Notify Student
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* Appeal resolution */}
      {canAppeal && c.appealStatus === 'Pending' && (
        <div className="rounded-2xl border border-violet-200 bg-surface p-6 shadow-[var(--shadow-sm)]">
          <p className="eyebrow text-violet-700 mb-1">Resolve Appeal</p>
          <p className="text-[13px] text-ink-500 mb-5 leading-relaxed">
            Overturning clears the original decision; upholding leaves it in force. Either outcome is emailed to the student.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAppealAction('Overturned')}
              aria-pressed={appealAction === 'Overturned'}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-[13px] font-medium
                          transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                appealAction === 'Overturned'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]'
                  : 'border-[var(--hairline)] bg-white text-ink-600 hover:border-[var(--hairline-strong)] hover:bg-ink-50 hover:text-ink-900'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                  appealAction === 'Overturned' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-ink-300 bg-white text-transparent'
                }`}
              >
                <Check size={11} strokeWidth={3} />
              </span>
              Overturn Decision
            </button>
            <button
              type="button"
              onClick={() => setAppealAction('Upheld')}
              aria-pressed={appealAction === 'Upheld'}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-[13px] font-medium
                          transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                appealAction === 'Upheld'
                  ? 'border-rose-400 bg-rose-50 text-rose-800 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]'
                  : 'border-[var(--hairline)] bg-white text-ink-600 hover:border-[var(--hairline-strong)] hover:bg-ink-50 hover:text-ink-900'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                  appealAction === 'Upheld' ? 'border-rose-500 bg-rose-500 text-white' : 'border-ink-300 bg-white text-transparent'
                }`}
              >
                <Check size={11} strokeWidth={3} />
              </span>
              Uphold Original Decision
            </button>
          </div>
          {appealAction && (
            <button
              type="button"
              onClick={onResolveAppeal}
              disabled={busy}
              className="w-full mt-4 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)]
                         transition-all duration-[var(--dur)] ease-[var(--ease-out)]
                         hover:bg-violet-800 hover:shadow-[var(--shadow-md)] active:translate-y-px
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Confirm Appeal Resolution: {appealAction}
            </button>
          )}
        </div>
      )}

      {/* Manual status change — the only path out of "Decided" for a case with no sanction to serve. */}
      <StatusChanger c={c} actor={actor} onChanged={onStatusChanged} />

      {/* Audit trail */}
      <div className="card p-6">
        <p className="eyebrow mb-4">Audit Trail</p>
        <div className="space-y-0">
          {c.auditTrail.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0 ring-4 ring-brand-50" />
                {i < c.auditTrail.length - 1 && <div className="w-px flex-1 bg-[var(--hairline-strong)] mt-1.5" />}
              </div>
              <div className="pb-4 min-w-0">
                <p className="text-[13px] text-ink-800 leading-snug">{entry.action}</p>
                <p className="text-[11px] font-tight text-ink-400 mt-1 tabular">{entry.by} · {entry.timestamp}</p>
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
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-mono tabular text-ink-400 mb-1.5">{c.id}</p>
          <p className="display-md text-ink-900 truncate">{c.studentName}</p>
          <p className="text-[13px] text-ink-500 mt-1">
            Student ID <span className="font-mono tabular text-ink-600">{c.studentId}</span>
          </p>
        </div>
        <div className="shrink-0"><StatusBadge status={c.registrationStatus} /></div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--hairline)] pt-5 mb-5">
        <Fact label="Offense">{c.offenseType}</Fact>
        <Fact label="Decision">
          {c.decision ? <StatusBadge status={c.decision} /> : <span className="text-ink-400">Pending</span>}
        </Fact>
        {c.suspensionStart && <Fact label="Suspension Start"><span className="tabular">{c.suspensionStart}</span></Fact>}
        {c.suspensionEnd && <Fact label="Suspension End"><span className="tabular">{c.suspensionEnd}</span></Fact>}
        <Fact label="Case Status"><StatusBadge status={c.status} /></Fact>
      </div>

      {isResolved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-[13px] text-emerald-900 flex items-start gap-2.5 leading-relaxed">
          <UserCheck size={15} className="text-emerald-600 mt-0.5 shrink-0" />
          Student has been formally re-integrated. Registration is active.
        </div>
      )}
      {canReintegrate && (
        <div className="space-y-3">
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3.5 text-[13px] text-brand-900 leading-relaxed">
            Suspension period has ended. Student may be cleared to re-register.
          </div>
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)]
                       transition-all duration-[var(--dur)] ease-[var(--ease-out)]
                       hover:bg-emerald-700 hover:shadow-[var(--shadow-md)] active:translate-y-px
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Approve Re-integration & Restore Registration
          </button>
        </div>
      )}
      {!canReintegrate && !isResolved && c.suspensionEnd && c.suspensionEnd > today && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-[13px] text-amber-900 leading-relaxed">
          Suspension period has not yet ended (<span className="tabular">{c.suspensionEnd}</span>). Re-integration cannot be approved at this time.
        </div>
      )}
      {!c.decision && (
        <div className="rounded-xl border border-[var(--hairline)] bg-ink-50 p-3.5 text-[13px] text-ink-600 leading-relaxed">
          No decision has been recorded for this case yet.
        </div>
      )}
    </div>
  );
}
