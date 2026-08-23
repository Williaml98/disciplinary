import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LayoutDashboard, AlertTriangle, List, Clock, ChevronRight, Bell, UserCog, Plus, AlertCircle, BookOpen, Users, GraduationCap, Settings, Pencil, Ban, RotateCcw, Mail, X, Scale, BarChart3, ArrowLeft, Loader2 } from 'lucide-react';
import { DashboardLayout, PageHeader, PrimaryButton, StatusBadge, EvidenceGallery } from './DashboardLayout';
import { DisciplinaryRulesPage } from './DisciplinaryRulesPage';
import { ReportsPage } from './ReportsPage';
import type { AppUser, DisciplinaryCase, Role } from './mockData';
import {
  fetchUsersPage, createUser, updateUserRole, updateUserStatus, updateUserProfile,
  deleteUser as apiDeleteUser, fetchUserImpact, fetchAuditFeed,
} from '../../lib/api';
import { usePagedCases } from '../../lib/usePagedCases';
import { useCaseStats, useDebouncedValue, useMonthlyCaseCounts, useUserStats } from '../../lib/hooks';
import { Pagination } from './Pagination';
import { Avatar } from './Avatar';
import { StatusChanger } from './StatusChanger';
import { SearchInput } from './SearchInput';
import { DepartmentSelect } from './DepartmentSelect';
import type { AuditFeedEntry, CaseStatus, UserImpact } from './mockData';
import { notifyError, notifySuccess, toMessage } from '../../lib/toast';

interface Props {
  user: AppUser;
  onLogout: () => void;
  onUpdateProfile: (updated: AppUser) => void;
}

/*
 * Chart colours are literal hex rather than the Tailwind token utilities: recharts writes them onto
 * SVG presentation attributes, which don't resolve CSS custom properties. They're picked to match the
 * StatusBadge palette so a slice and its badge read as the same thing.
 */
const PIE_COLORS = [
  '#9aa0ac', // Reported     — ink-400
  '#f59e0b', // Under Review — amber-500
  '#3d6796', // Decided      — brand-500
  '#8b5cf6', // Under Appeal — violet-500
  '#10b981', // Resolved     — emerald-500
];
const CHART_NAVY = '#1d3a5f'; // brand-700
const CHART_GRID = '#e0e3e9'; // ink-200
const CHART_AXIS = '#9aa0ac'; // ink-400
const CHART_TOOLTIP: React.CSSProperties = {
  borderRadius: '12px',
  border: '1px solid rgba(29, 58, 95, 0.10)',
  boxShadow: '0 4px 8px rgba(13, 28, 46, 0.06), 0 12px 28px rgba(13, 28, 46, 0.10)',
  fontSize: '12px',
  fontFamily: 'var(--font-tight)',
  padding: '8px 12px',
};

const ROLE_OPTIONS: { value: Role; label: string; icon: React.ReactNode }[] = [
  { value: 'lecturer', label: 'Lecturer / Invigilator', icon: <BookOpen size={14} /> },
  { value: 'committee', label: 'Committee Member', icon: <Users size={14} /> },
  { value: 'student', label: 'Student', icon: <GraduationCap size={14} /> },
  { value: 'admin', label: 'Registrar / Admin', icon: <Settings size={14} /> },
];

const ROLE_LABELS: Record<Role, string> = {
  lecturer: 'Lecturer / Invigilator',
  committee: 'Committee Member',
  student: 'Student',
  admin: 'Registrar / Admin',
};

/** Surface treatment for the shared SearchInput, which brings no chrome of its own. */
const SEARCH_SHELL = 'rounded-xl border border-[var(--hairline)] bg-white px-3.5 py-2.5';

/** Quiet counterpart to PrimaryButton, for cancel / dismiss actions. */
const SECONDARY_BUTTON =
  `w-full rounded-xl border border-[var(--hairline)] bg-white px-4 py-2.5 text-sm font-medium text-ink-700
   hover:bg-ink-50 hover:border-[var(--hairline-strong)] disabled:opacity-60 disabled:cursor-not-allowed
   transition-all duration-[var(--dur)] ease-[var(--ease-out)]`;

/** Filter pill used by the status, role and audit-kind toolbars. */
function chipCls(active: boolean) {
  return `px-3 py-1.5 rounded-full text-[12px] font-tight font-medium whitespace-nowrap border
          transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
    active
      ? 'bg-brand-700 text-white border-brand-700 shadow-[var(--shadow-xs)]'
      : 'bg-white text-ink-600 border-[var(--hairline)] hover:bg-ink-50 hover:border-[var(--hairline-strong)] hover:text-ink-900'
  }`;
}

export function AdminDashboard({ user, onLogout, onUpdateProfile }: Props) {
  const [activeNav, setActiveNav] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedCase, setSelectedCase] = useState<DisciplinaryCase | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Every tile, badge and pie slice now comes from server-side aggregates rather than being counted
  // off a loaded array — which, with the list paginated, would silently describe only the current page.
  const stats = useCaseStats();
  const userStats = useUserStats();
  const monthly = useMonthlyCaseCounts();

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const caseFilters = {
    search: debouncedSearch || undefined,
    status: statusFilter === 'All' ? undefined : ([statusFilter] as CaseStatus[]),
  };
  const pagedCases = usePagedCases(caseFilters, { size: 20, sort: 'reportDate,desc' });

  const recentCases = usePagedCases({}, { size: 5, sort: 'reportDate,desc', enabled: activeNav === 'overview' });

  // The registrar-alert buckets are deliberately NOT paginated: this screen exists to triage everything
  // before registration opens, and three separate pagers would make it worse at exactly that. A high
  // page size plus an explicit truncation note is more honest than silently showing the first page.
  const alertsEnabled = activeNav === 'alerts';
  const expired = usePagedCases(
    { registrationStatus: 'Restricted', suspensionEndTo: yesterday }, { size: 100, enabled: alertsEnabled });
  const active = usePagedCases(
    { registrationStatus: 'Restricted', suspensionEndFrom: today }, { size: 100, enabled: alertsEnabled });
  const flagged = usePagedCases(
    { registrationStatus: 'Flagged' }, { size: 100, enabled: alertsEnabled });
  // Restricted with no end date — an expulsion. Every other bucket filters on a date range, and those
  // all exclude NULLs, so without this the expelled were on no list at all.
  const expelledCases = usePagedCases(
    { registrationStatus: 'Restricted', suspensionEndMissing: true }, { size: 100, enabled: alertsEnabled });

  const pieData = stats.data ? [
    { name: 'Reported', value: stats.data.reported },
    { name: 'Under Review', value: stats.data.underReview },
    { name: 'Decided', value: stats.data.decided },
    { name: 'Under Appeal', value: stats.data.underAppeal },
    { name: 'Resolved', value: stats.data.resolved },
  ] : [];

  const alertBadge = stats.data?.registrationHolds ?? 0;

  const navItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: <LayoutDashboard size={16} /> },
    { id: 'alerts', label: 'Registrar Alerts', icon: <Bell size={16} />, badge: alertBadge },
    { id: 'cases', label: 'All Cases', icon: <List size={16} /> },
    { id: 'users', label: 'User Management', icon: <UserCog size={16} /> },
    { id: 'audit', label: 'Audit Log', icon: <Clock size={16} /> },
    { id: 'rules', label: 'Disciplinary Rules', icon: <Scale size={16} /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 size={16} /> },
  ];

  return (
    <DashboardLayout user={user} onLogout={onLogout} onUpdateProfile={onUpdateProfile} navItems={navItems} activeNav={activeNav}
      onNavChange={id => { setActiveNav(id); setSelectedCase(null); }}>

      {/* ── OVERVIEW ── */}
      {activeNav === 'overview' && (
        <>
          <PageHeader title="Dashboard Overview" subtitle="System-wide case statistics and activity summary" />
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="space-y-6 sm:space-y-8 rise">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                <StatCard label="Total Cases" value={stats.data?.total ?? 0} color="primary" />
                <StatCard label="Open Cases" value={stats.data?.open ?? 0} color="amber" sub={`${stats.data?.underReview ?? 0} under review`} />
                <StatCard label="Active Suspensions" value={stats.data?.activeSuspensions ?? 0} color="red" sub="registration restricted" />
                <StatCard label="Registered Users" value={userStats.data?.total ?? 0} color="green" sub={`${userStats.data?.student ?? 0} students`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
                <div className="lg:col-span-2 card p-6">
                  <p className="eyebrow">Volume</p>
                  <h2 className="display-md text-ink-900 mt-1 mb-5">Cases Reported by Month</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthly.data ?? []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_AXIS }} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
                      <YAxis tick={{ fontSize: 11, fill: CHART_AXIS }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(29, 58, 95, 0.05)' }} contentStyle={CHART_TOOLTIP} />
                      <Bar dataKey="count" name="Cases Reported" fill={CHART_NAVY} radius={[5, 5, 0, 0]} maxBarSize={38} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card p-6">
                  <p className="eyebrow">Composition</p>
                  <h2 className="display-md text-ink-900 mt-1 mb-4">Cases by Status</h2>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={CHART_TOOLTIP} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 pt-4 border-t border-[var(--hairline)] space-y-2">
                    {/* Index against the original array, not the filtered one — filtering out the
                        empty statuses shifted the colour lookup, so the legend swatches stopped
                        matching the slices they label. */}
                    {pieData.map((d, i) => ({ ...d, colour: PIE_COLORS[i % PIE_COLORS.length] }))
                      .filter(d => d.value > 0)
                      .map(d => (
                      <div key={d.name} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-2 text-ink-600">
                          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: d.colour }} />
                          {d.name}
                        </span>
                        <span className="font-tight font-semibold text-ink-800 tabular">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <p className="eyebrow">Latest activity</p>
                <h2 className="display-md text-ink-900 mt-1 mb-3">Recent Cases</h2>
                <div>
                  {recentCases.items.map(c => (
                    <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-[var(--hairline)] last:border-0">
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-[11px] font-mono tabular text-ink-400 w-24 shrink-0">{c.id}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-900 truncate">{c.studentName}</p>
                          <p className="text-xs text-ink-500 tabular">{c.offenseType} · {c.reportDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={c.status} />
                        <StatusBadge status={c.registrationStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ALERTS ── */}
      {activeNav === 'alerts' && (
        <>
          <PageHeader title="Registrar Alerts" subtitle="Students requiring action before semester registration opens" />
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-5 sm:space-y-6">
            {expelledCases.items.length > 0 && (
              <AlertSection title="Expelled — Registration Permanently Blocked" color="red"
                items={expelledCases.items} total={expelledCases.totalElements}
                message="These students have been expelled. They must never be permitted to register, and there is no end date on the restriction." />
            )}
            {expired.items.length > 0 && (
              <AlertSection title="Suspension Ended — Awaiting Re-integration Clearance" color="red"
                items={expired.items} total={expired.totalElements}
                message="These students have served their suspension but have NOT yet been formally cleared. Their registration remains restricted. The committee must approve re-integration." />
            )}
            {active.items.length > 0 && (
              <AlertSection title="Active Suspensions — Registration Blocked" color="orange"
                items={active.items} total={active.totalElements}
                message="These students are currently under suspension and must NOT be permitted to register for any courses." />
            )}
            {flagged.items.length > 0 && (
              <AlertSection title="Pending Cases — Registration Flagged" color="amber"
                items={flagged.items} total={flagged.totalElements}
                message="These students have open cases not yet decided. Monitor before permitting registration." />
            )}
            {alertBadge === 0 && (
              <div className="card">
                <EmptyState
                  icon={<Bell size={20} />}
                  title="No registrar alerts"
                  hint="Every student is clear to register. New holds appear here as soon as a case restricts one."
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ALL CASES ── */}
      {activeNav === 'cases' && (
        <>
          <PageHeader title="All Cases" subtitle={`${pagedCases.totalElements} case${pagedCases.totalElements !== 1 ? 's' : ''} found`} />
          {selectedCase ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-900 mb-5 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]"
              >
                <ArrowLeft size={14} /> Back to cases
              </button>
              <AdminCaseDetail
            c={selectedCase}
            actor={user.name}
            onStatusChanged={updated => {
              setSelectedCase(updated);
              pagedCases.replaceItem(updated);
              pagedCases.reload();
              stats.reload();
            }}
          />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="bg-surface border-b border-[var(--hairline)] px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by student, ID, case number or offense…"
                  resultCount={searchQuery ? pagedCases.totalElements : undefined}
                  className={`flex-1 ${SEARCH_SHELL}`}
                />
                <div className="flex gap-1.5 flex-wrap">
                  {['All', 'Reported', 'Under Review', 'Decided', 'Under Appeal', 'Resolved'].map(s => (
                    <button key={s} type="button" onClick={() => setStatusFilter(s)}
                      aria-pressed={statusFilter === s}
                      className={chipCls(statusFilter === s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[880px]">
                  <thead className="bg-ink-50/95 backdrop-blur-sm border-b border-[var(--hairline)] sticky top-0 z-10">
                    <tr>
                      {['Case ID', 'Student', 'Offense', 'Reported', 'Status', 'Decision', 'Registration', ''].map(h => (
                        <th key={h} className="text-left px-6 py-3 eyebrow">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[var(--hairline)]">
                    {pagedCases.items.map(c => (
                      <tr key={c.id} className="hover:bg-brand-50/40 transition-colors duration-[var(--dur)]">
                        <td className="px-6 py-4 text-[11px] font-mono tabular text-ink-500 whitespace-nowrap">{c.id}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-ink-900">{c.studentName}</p>
                          <p className="text-xs text-ink-400 tabular whitespace-nowrap">ID: {c.studentId}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-ink-600">{c.offenseType}</td>
                        <td className="px-6 py-4 text-sm text-ink-500 tabular" style={{ whiteSpace: "nowrap" }}>{c.reportDate}</td>
                        <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                        <td className="px-6 py-4">{c.decision ? <StatusBadge status={c.decision} /> : <span className="text-ink-300 text-xs">—</span>}</td>
                        <td className="px-6 py-4"><StatusBadge status={c.registrationStatus} /></td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedCase(c)}
                            aria-label={`Open case ${c.id}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-brand-700 hover:bg-brand-50
                                       transition-colors duration-[var(--dur)] ease-[var(--ease-out)]"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pagedCases.loading && pagedCases.items.length === 0 && (
                  <LoadingNote>Loading cases…</LoadingNote>
                )}
                {pagedCases.error && (
                  <ErrorNote message={pagedCases.error} className="mx-4 sm:mx-8 mt-4" />
                )}
                {!pagedCases.loading && !pagedCases.error && pagedCases.items.length === 0 && (
                  <EmptyState
                    icon={<List size={20} />}
                    title="No cases match your search"
                    hint="Try a different name, ID or case number — or reset the status filter to All."
                  />
                )}
              </div>
              <Pagination
                page={pagedCases.page}
                totalPages={pagedCases.totalPages}
                totalElements={pagedCases.totalElements}
                first={pagedCases.first}
                last={pagedCases.last}
                onPageChange={pagedCases.setPage}
                label="case"
              />
            </div>
          )}
        </>
      )}

      {/* ── USER MANAGEMENT ── */}
      {activeNav === 'users' && <UserManagement currentAdmin={user} />}

      {/* ── AUDIT LOG ── */}
      {activeNav === 'audit' && <AuditLog />}

      {activeNav === 'rules' && <DisciplinaryRulesPage />}
      {activeNav === 'reports' && <ReportsPage />}
    </DashboardLayout>
  );
}

/* ────────────────────────────────────────────────────────────
   USER MANAGEMENT PANEL
──────────────────────────────────────────────────────────── */
function UserManagement({ currentAdmin }: { currentAdmin: AppUser }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [page, setPage] = useState(0);
  const [pageMeta, setPageMeta] = useState({ totalPages: 0, totalElements: 0, first: true, last: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  // Chip counts stay global rather than counting the loaded page, which would show "how many are on
  // screen" instead of how many accounts of each role exist.
  const stats = useUserStats();

  // Narrowing the filter while on a later page would otherwise land on a page that no longer exists.
  useEffect(() => { setPage(0); }, [debouncedSearch, roleFilter]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchUsersPage({
      search: debouncedSearch || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      page,
      size: 20,
    })
      .then(result => {
        if (!active) return;
        setUsers(result.content);
        setPageMeta({
          totalPages: result.totalPages,
          totalElements: result.totalElements,
          first: result.first,
          last: result.last,
        });
      })
      .catch(err => active && setError(toMessage(err, 'Unable to load users.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [debouncedSearch, roleFilter, page, reloadToken]);

  const reload = () => setReloadToken(t => t + 1);

  async function changeRole(userId: string, newRole: Role) {
    setBusyUserId(userId);
    try {
      const updated = await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? updated : u));
      notifySuccess(`${updated.name} is now ${ROLE_LABELS[newRole]}.`);
      stats.reload();
      // The row may no longer match an active role filter, so reconcile the list.
      if (roleFilter !== 'all') reload();
    } catch (err) {
      notifyError(err, 'Unable to update role.');
    } finally {
      setBusyUserId(null);
    }
  }

  async function toggleActive(target: AppUser) {
    setBusyUserId(target.id);
    try {
      const updated = await updateUserStatus(target.id, !target.active);
      setUsers(prev => prev.map(u => u.id === target.id ? updated : u));
      notifySuccess(
        updated.active ? `${updated.name} can sign in again.` : `${updated.name} has been deactivated.`,
        updated.active ? undefined : 'They can no longer sign in, and their cases are untouched.',
      );
    } catch (err) {
      notifyError(err, 'Unable to change account status.');
    } finally {
      setBusyUserId(null);
    }
  }

  async function confirmDelete(target: AppUser) {
    setBusyUserId(target.id);
    try {
      await apiDeleteUser(target.id);
      notifySuccess(`${target.name} was removed.`);
      setDeleteTarget(null);
      stats.reload();
      reload();
    } catch (err) {
      notifyError(err, 'Unable to remove account.');
    } finally {
      setBusyUserId(null);
    }
  }

  function handleCreate(newUser: AppUser) {
    setShowCreateForm(false);
    notifySuccess(
      `Account created for ${newUser.name}.`,
      'A welcome email with a temporary password has been sent.',
    );
    stats.reload();
    setPage(0);
    reload();
  }

  function handleEdited(updated: AppUser) {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    setEditingUser(null);
    notifySuccess(`${updated.name}'s details were updated.`);
  }

  const roleCounts = {
    all: stats.data?.total ?? 0,
    admin: stats.data?.admin ?? 0,
    committee: stats.data?.committee ?? 0,
    lecturer: stats.data?.lecturer ?? 0,
    student: stats.data?.student ?? 0,
  };

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle={`${pageMeta.totalElements} account${pageMeta.totalElements !== 1 ? 's' : ''} registered`}
        action={
          <PrimaryButton onClick={() => setShowCreateForm(true)}>
            <Plus size={15} /> Create Account
          </PrimaryButton>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="bg-surface border-b border-[var(--hairline)] px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name or email…"
            resultCount={searchQuery ? pageMeta.totalElements : undefined}
            className={`flex-1 ${SEARCH_SHELL}`}
          />
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'admin', 'committee', 'lecturer', 'student'] as const).map(r => (
              <button key={r} type="button" onClick={() => setRoleFilter(r)}
                aria-pressed={roleFilter === r}
                className={chipCls(roleFilter === r)}>
                {r === 'all' ? 'All' : r === 'committee' ? 'Committee' : ROLE_LABELS[r]}
                <span className={`ml-1.5 tabular ${roleFilter === r ? 'text-white/60' : 'text-ink-400'}`}>
                  {roleCounts[r]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-ink-50/95 backdrop-blur-sm border-b border-[var(--hairline)] sticky top-0 z-10">
              <tr>
                {['User', 'Email', 'Role', 'Additional Info', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-6 py-3 eyebrow">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[var(--hairline)]">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-brand-50/40 transition-colors duration-[var(--dur)] ${u.active ? '' : 'opacity-60'}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size={32} />
                      <div>
                        <p className="text-sm font-medium text-ink-900">{u.name}</p>
                        {u.id === currentAdmin.id && <p className="text-xs text-ink-400">(you)</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-ink-500 whitespace-nowrap">{u.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      disabled={busyUserId === u.id || u.id === currentAdmin.id}
                      onChange={e => changeRole(u.id, e.target.value as Role)}
                      aria-label={`Role for ${u.name}`}
                      className="rounded-lg border border-[var(--hairline-strong)] bg-white px-2.5 py-1.5 text-xs text-ink-700
                                 outline-none transition-all duration-[var(--dur)] ease-[var(--ease-out)]
                                 disabled:bg-ink-50 disabled:text-ink-400 disabled:border-[var(--hairline)]"
                      onFocus={focusStyleSelect}
                      onBlur={blurStyleSelect}
                    >
                      {ROLE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      {u.studentId && (
                        <span className="bg-ink-100 text-ink-700 font-mono tabular px-2 py-0.5 rounded-full text-[11px]">
                          ID: {u.studentId}
                        </span>
                      )}
                      {u.department && <span className="text-xs text-ink-500">{u.department}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-tight font-semibold
                                       bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-tight font-semibold
                                       bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200">
                        <Ban size={10} /> Deactivated
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {u.id === currentAdmin.id ? (
                      <span className="text-xs text-ink-300">—</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setEditingUser(u)} disabled={busyUserId === u.id}
                          className="flex items-center gap-1 text-[12px] font-tight font-medium text-ink-500 hover:text-brand-700
                                     disabled:opacity-60 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]">
                          <Pencil size={12} /> Edit
                        </button>
                        {/* Deactivation sits alongside delete, not in place of it: it's reversible and
                            keeps the account's name resolvable from the cases that reference it. */}
                        <button type="button" onClick={() => toggleActive(u)} disabled={busyUserId === u.id}
                          className="flex items-center gap-1 text-[12px] font-tight font-medium text-ink-500 hover:text-amber-600
                                     disabled:opacity-60 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]">
                          {u.active ? <><Ban size={12} /> Deactivate</> : <><RotateCcw size={12} /> Reactivate</>}
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(u)} disabled={busyUserId === u.id}
                          className="text-[12px] font-tight font-medium text-rose-500 hover:text-rose-700
                                     disabled:opacity-60 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]">
                          {busyUserId === u.id ? 'Working…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && users.length === 0 && (
            <LoadingNote>Loading accounts…</LoadingNote>
          )}
          {error && (
            <ErrorNote message={error} className="mx-4 sm:mx-8 mt-4" />
          )}
          {!loading && !error && users.length === 0 && (
            <EmptyState
              icon={<Users size={20} />}
              title="No accounts match your search"
              hint="Try another name or email, or switch the role filter back to All."
            />
          )}
        </div>

        <Pagination
          page={page}
          totalPages={pageMeta.totalPages}
          totalElements={pageMeta.totalElements}
          first={pageMeta.first}
          last={pageMeta.last}
          onPageChange={setPage}
          label="account"
        />
      </div>

      {showCreateForm && (
        <CreateAccountModal onCreate={handleCreate} onClose={() => setShowCreateForm(false)} />
      )}
      {editingUser && (
        <EditAccountModal user={editingUser} onSaved={handleEdited} onClose={() => setEditingUser(null)} />
      )}
      {deleteTarget && (
        <DeleteAccountDialog
          user={deleteTarget}
          busy={busyUserId === deleteTarget.id}
          onConfirm={() => confirmDelete(deleteTarget)}
          onDeactivateInstead={() => { toggleActive(deleteTarget); setDeleteTarget(null); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}


/* ────────────────────────────────────────────────────────────
   CREATE ACCOUNT MODAL
──────────────────────────────────────────────────────────── */
function CreateAccountModal({ onCreate, onClose }: {
  onCreate: (user: AppUser) => void;
  onClose: () => void;
}) {
  const [form, setFormState] = useState({ name: '', email: '', role: '' as Role | '', studentId: '', department: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const isStudent = form.role === 'student';
  const needsDept = form.role === 'lecturer' || form.role === 'committee' || form.role === 'admin';

  function set(field: string, value: string) {
    setFormState(f => ({ ...f, [field]: value }));
    setErrors(e => { const ne = { ...e }; delete ne[field]; return ne; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Full name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    // Duplicate emails are no longer pre-checked against a loaded user list — with the list paginated,
    // that array only holds one page, so it would miss most collisions. The backend returns a 409.
    if (!form.role) e.role = 'Please select a role.';
    if (isStudent && !form.studentId.trim()) e.studentId = 'Student ID is required.';
    if (!form.department.trim()) e.department = isStudent ? 'Programme is required.' : 'Department is required.';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setCreating(true);
    try {
      const newUser = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role as Role,
        ...(isStudent ? { studentId: form.studentId.trim() } : {}),
        ...(needsDept ? { department: form.department.trim() } : {}),
      });
      onCreate(newUser);
    } catch (err) {
      // Toast rather than setErrors({ email: ... }) — a server error about any field used to render
      // under the Email input regardless of what it was actually about.
      notifyError(err, 'Unable to create account. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-account-title"
        className="relative w-full max-w-md h-full bg-surface shadow-[var(--shadow-xl)] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-5 bg-brand-700 shrink-0">
          <div>
            <p className="text-brand-300/80 text-[10px] font-tight font-semibold uppercase tracking-[0.14em]">User management</p>
            <h2 id="create-account-title" className="display-md text-white mt-1">Create New Account</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-white/60 hover:text-white transition-colors duration-[var(--dur)] ease-[var(--ease-out)] p-1 rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ModalField label="Full Name" error={errors.name}>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Dr. Marie Claire Uwase" className={inputCls(!!errors.name)}
                onFocus={focusStyle} onBlur={blurStyle} />
            </ModalField>

            <ModalField label="Email Address" error={errors.email}>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="user@auca.ac.rw" className={inputCls(!!errors.email)}
                onFocus={focusStyle} onBlur={blurStyle} />
            </ModalField>

            <ModalField label="Role" error={errors.role}>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => { set('role', opt.value); set('studentId', ''); set('department', ''); }}
                    aria-pressed={form.role === opt.value}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-medium text-left
                                transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                      form.role === opt.value
                        ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-[var(--shadow-xs)]'
                        : 'border-[var(--hairline)] bg-white text-ink-600 hover:border-[var(--hairline-strong)] hover:bg-ink-50'
                    }`}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </ModalField>

            {isStudent && (
              <ModalField label="Student ID" error={errors.studentId}>
                <input type="text" value={form.studentId} onChange={e => set('studentId', e.target.value)}
                  placeholder="e.g. 21045" className={inputCls(!!errors.studentId)}
                  onFocus={focusStyle} onBlur={blurStyle} />
              </ModalField>
            )}

            {/* Every role has a department — a student's is their programme, a staff member's is
                their faculty or office. Students previously got only a student ID here, so an
                admin-created student ended up with no department while a self-registered one had to
                supply it. */}
            {form.role && (
              <ModalField label={isStudent ? 'Programme' : 'Department'} error={errors.department}>
                <DepartmentSelect
                  role={form.role}
                  value={form.department}
                  onChange={v => set('department', v)}
                  placeholder={isStudent ? 'Select a programme…' : 'Select a department…'}
                  className={inputCls(!!errors.department)}
                  onFocus={focusStyleSelect}
                  onBlur={blurStyleSelect}
                />
              </ModalField>
            )}

            {/* No password fields: the backend generates a one-time password and emails it, then forces
                a change at first sign-in, so an admin never handles someone else's credential. */}
            <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
              <Mail size={14} className="text-brand-600 shrink-0 mt-0.5" />
              <p className="text-[12px] text-brand-900 leading-relaxed">
                A welcome email with a temporary password will be sent to this address. They'll be asked
                to choose their own password the first time they sign in.
              </p>
            </div>

            <div className="pt-1 space-y-2">
              <PrimaryButton type="submit" disabled={creating} className="w-full">
                {creating ? 'Creating Account…' : 'Create Account'}
              </PrimaryButton>
              <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   EDIT ACCOUNT — name / email / department / student ID
──────────────────────────────────────────────────────────── */

/**
 * Admins could previously only change a user's role or delete them outright; the PATCH endpoint that
 * accepts name, email, department and student ID already existed but was wired only to self-service
 * profile editing.
 */
function EditAccountModal({ user, onSaved, onClose }: {
  user: AppUser;
  onSaved: (updated: AppUser) => void;
  onClose: () => void;
}) {
  const [form, setFormState] = useState({
    name: user.name,
    email: user.email,
    department: user.department ?? '',
    studentId: user.studentId ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isStudent = user.role === 'student';

  function set(field: string, value: string) {
    setFormState(f => ({ ...f, [field]: value }));
    setErrors(e => { const ne = { ...e }; delete ne[field]; return ne; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!form.name.trim()) found.name = 'Full name is required.';
    if (!form.email.trim()) found.email = 'Email is required.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      onSaved(await updateUserProfile(user.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department.trim() || undefined,
        studentId: form.studentId.trim() || undefined,
      }));
    } catch (err) {
      notifyError(err, 'Unable to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-account-title"
        className="relative w-full max-w-md h-full bg-surface shadow-[var(--shadow-xl)] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-5 bg-brand-700 shrink-0">
          <div>
            <p className="text-brand-300/80 text-[10px] font-tight font-semibold uppercase tracking-[0.14em]">User management</p>
            <h2 id="edit-account-title" className="display-md text-white mt-1">Edit Account</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-white/60 hover:text-white transition-colors duration-[var(--dur)] ease-[var(--ease-out)] p-1 rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-[var(--hairline)]">
            <Avatar user={user} size={40} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900 truncate">{user.name}</p>
              <p className="text-xs text-ink-500">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <ModalField label="Full Name" error={errors.name}>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                className={inputCls(!!errors.name)} onFocus={focusStyle} onBlur={blurStyle} />
            </ModalField>

            <ModalField label="Email Address" error={errors.email}>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className={inputCls(!!errors.email)} onFocus={focusStyle} onBlur={blurStyle} />
            </ModalField>

            {isStudent && (
              <ModalField label="Student ID" error={errors.studentId}>
                <input type="text" value={form.studentId} onChange={e => set('studentId', e.target.value)}
                  className={inputCls(!!errors.studentId)} onFocus={focusStyle} onBlur={blurStyle} />
              </ModalField>
            )}

            <ModalField label={isStudent ? 'Programme' : 'Department'} error={errors.department}>
              <DepartmentSelect
                role={user.role}
                value={form.department}
                onChange={v => set('department', v)}
                placeholder="No department"
                className={inputCls(!!errors.department)}
                onFocus={focusStyleSelect}
                onBlur={blurStyleSelect}
              />
            </ModalField>

            {isStudent && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-900 leading-relaxed">
                  Changing a student ID re-points which case this account can see. Only change it to
                  correct a mistake.
                </p>
              </div>
            )}

            <div className="pt-1 space-y-2">
              <PrimaryButton type="submit" disabled={saving} className="w-full">
                {saving ? 'Saving…' : 'Save Changes'}
              </PrimaryButton>
              <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   DELETE CONFIRMATION — with impact warning
──────────────────────────────────────────────────────────── */

/**
 * Delete used to happen on a single click with no confirmation at all.
 *
 * Cases reference people by display-name string rather than by foreign key, so a delete never fails —
 * it silently leaves those references pointing at nobody. The impact counts come from the server so the
 * admin sees what would be orphaned, and deactivating is offered as the reversible alternative.
 */
function DeleteAccountDialog({ user, busy, onConfirm, onDeactivateInstead, onClose }: {
  user: AppUser;
  busy: boolean;
  onConfirm: () => void;
  onDeactivateInstead: () => void;
  onClose: () => void;
}) {
  const [impact, setImpact] = useState<UserImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(true);

  useEffect(() => {
    let active = true;
    fetchUserImpact(user.id)
      .then(result => active && setImpact(result))
      .catch(() => active && setImpact(null))
      .finally(() => active && setLoadingImpact(false));
    return () => { active = false; };
  }, [user.id]);

  const hasImpact = !!impact
    && (impact.casesReported > 0 || impact.casesAsStudent > 0 || impact.notesAuthored > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="relative w-full max-w-md card shadow-[var(--shadow-xl)] overflow-hidden rise"
      >
        <div className="p-6">
          <div className="flex items-start gap-3.5 mb-5">
            <div className="w-10 h-10 rounded-full bg-rose-50 ring-1 ring-inset ring-rose-200/70 flex items-center justify-center shrink-0">
              <AlertTriangle size={17} className="text-rose-600" />
            </div>
            <div className="min-w-0">
              <h2 id="delete-account-title" className="display-md text-ink-900">Delete {user.name}?</h2>
              <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">
                This permanently removes the account. It cannot be undone.
              </p>
            </div>
          </div>

          {loadingImpact ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-ink-50 px-4 py-3 mb-5 text-[13px] text-ink-500">
              <Loader2 size={14} className="animate-spin shrink-0" />
              Checking what references this account…
            </div>
          ) : hasImpact && impact ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 mb-5">
              <p className="eyebrow text-amber-700 mb-2">
                Referenced by existing records
              </p>
              <ul className="text-[13px] text-amber-900 space-y-1 tabular">
                {impact.casesReported > 0 && (
                  <li>• {impact.casesReported} case{impact.casesReported === 1 ? '' : 's'} they reported</li>
                )}
                {impact.casesAsStudent > 0 && (
                  <li>• {impact.casesAsStudent} case{impact.casesAsStudent === 1 ? '' : 's'} filed against them</li>
                )}
                {impact.notesAuthored > 0 && (
                  <li>• {impact.notesAuthored} committee note{impact.notesAuthored === 1 ? '' : 's'} they authored</li>
                )}
              </ul>
              <p className="text-[12px] text-amber-800 mt-2.5 leading-relaxed">
                Those records stay, but will point at a name with no account behind it. Deactivating keeps
                the link intact and blocks sign-in.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--hairline)] bg-ink-50 px-4 py-3.5 mb-5">
              <p className="text-[13px] text-ink-600">No cases or notes reference this account.</p>
            </div>
          )}

          <div className="space-y-2">
            {hasImpact && (
              <PrimaryButton onClick={onDeactivateInstead} disabled={busy} className="w-full">
                Deactivate instead (recommended)
              </PrimaryButton>
            )}
            <button type="button" onClick={onConfirm} disabled={busy}
              className="w-full rounded-xl py-2.5 text-sm font-semibold bg-rose-600 text-white shadow-[var(--shadow-sm)]
                         hover:bg-rose-700 hover:shadow-[var(--shadow-md)] active:translate-y-px
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-[var(--dur)] ease-[var(--ease-out)]">
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BUTTON}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  // The figure carries the tone; the card itself stays white so four of them in a row don't read as a
  // stripe of tinted boxes.
  const styles: Record<string, { text: string; dot: string }> = {
    primary: { text: 'text-brand-700', dot: 'bg-brand-600' },
    amber: { text: 'text-amber-700', dot: 'bg-amber-500' },
    red: { text: 'text-rose-700', dot: 'bg-rose-500' },
    green: { text: 'text-emerald-700', dot: 'bg-emerald-500' },
  };
  const s = styles[color] || styles.primary;
  return (
    <div className="card card-interactive p-5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} aria-hidden="true" />
        <p className="eyebrow truncate">{label}</p>
      </div>
      <p className={`display-xl tabular ${s.text}`}>{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-1.5 tabular">{sub}</p>}
    </div>
  );
}

function AlertSection({ title, color, items, total, message }: {
  title: string; color: string; items: DisciplinaryCase[]; total: number; message: string;
}) {
  // A coloured rail down the edge plus a tinted header, rather than a flat wash of colour across the
  // whole panel: the severity stays legible while the student rows underneath stay readable.
  const styles: Record<string, { rail: string; tint: string; icon: string; title: string; body: string; count: string }> = {
    red: {
      rail: 'bg-rose-500', tint: 'bg-rose-50/80', icon: 'text-rose-600',
      title: 'text-rose-900', body: 'text-rose-800/90', count: 'bg-rose-100 text-rose-800',
    },
    orange: {
      rail: 'bg-orange-500', tint: 'bg-orange-50/80', icon: 'text-orange-600',
      title: 'text-orange-900', body: 'text-orange-800/90', count: 'bg-orange-100 text-orange-800',
    },
    amber: {
      rail: 'bg-amber-500', tint: 'bg-amber-50/80', icon: 'text-amber-600',
      title: 'text-amber-900', body: 'text-amber-800/90', count: 'bg-amber-100 text-amber-800',
    },
  };
  const s = styles[color];
  return (
    <section className="card relative overflow-hidden">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${s.rail}`} aria-hidden="true" />
      <div className={`${s.tint} border-b border-[var(--hairline)] pl-7 pr-6 py-5`}>
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={16} className={`${s.icon} shrink-0 mt-1`} />
          <div className="min-w-0">
            <h2 className={`display-md ${s.title}`}>
              {title}
              <span className={`ml-2.5 align-middle inline-flex items-center rounded-full px-2 py-0.5
                                text-[11px] font-tight font-semibold tabular ${s.count}`}>
                {total}
              </span>
            </h2>
            <p className={`text-[13px] mt-1.5 leading-relaxed ${s.body}`}>{message}</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-[var(--hairline)]">
        {items.map(c => (
          <div key={c.id}
            className="pl-7 pr-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5
                       hover:bg-ink-50/60 transition-colors duration-[var(--dur)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono tabular text-ink-400">{c.id}</span>
                <span className="text-sm font-medium text-ink-900">{c.studentName}</span>
                <span className="text-xs text-ink-400 tabular">({c.studentId})</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-ink-500 tabular flex-wrap">
                <span>{c.offenseType}</span>
                {c.suspensionStart && <span>Suspension: {c.suspensionStart} → {c.suspensionEnd}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={c.status} />
              <StatusBadge status={c.registrationStatus} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminCaseDetail({ c, actor, onStatusChanged }: {
  c: DisciplinaryCase;
  actor: string;
  onStatusChanged: (updated: DisciplinaryCase) => void;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-5 rise">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <p className="text-[11px] font-mono tabular text-ink-400 mb-1.5">{c.id}</p>
            <h2 className="display-lg text-ink-900 truncate">{c.studentName}</h2>
            <p className="text-[13px] text-ink-500 mt-0.5 tabular">Student ID: {c.studentId} · {c.reporterDepartment}</p>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            <StatusBadge status={c.status} />
            <StatusBadge status={c.registrationStatus} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[var(--hairline)] pt-5">
          <div>
            <p className="eyebrow mb-1">Offense</p>
            <p className="text-sm text-ink-900">{c.offenseType}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Reported</p>
            <p className="text-sm text-ink-900 tabular">{c.reportDate}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Reported By</p>
            <p className="text-sm text-ink-900">{c.reportedBy}</p>
          </div>
          {c.decision && (
            <div>
              <p className="eyebrow mb-1.5">Decision</p>
              <StatusBadge status={c.decision} />
            </div>
          )}
          {c.decisionDate && (
            <div>
              <p className="eyebrow mb-1">Decision Date</p>
              <p className="text-sm text-ink-900 tabular">{c.decisionDate}</p>
            </div>
          )}
          {c.suspensionStart && (
            <div>
              <p className="eyebrow mb-1">Suspension</p>
              <p className="text-sm text-ink-900 tabular">{c.suspensionStart} → {c.suspensionEnd}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <p className="eyebrow mb-2">Description</p>
        <p className="text-sm text-ink-700 leading-relaxed">{c.description}</p>
        <p className="eyebrow mt-5 mb-2">Evidence</p>
        <p className="text-sm text-ink-700 leading-relaxed">{c.evidence}</p>
        <EvidenceGallery files={c.evidenceFiles} />
      </div>

      {c.appealSubmitted && (
        <div className="card relative overflow-hidden p-6 pl-7">
          <span className="absolute inset-y-0 left-0 w-1.5 bg-violet-400" aria-hidden="true" />
          <p className="eyebrow text-violet-700 mb-2">Student Appeal</p>
          <p className="text-sm text-ink-800 leading-relaxed">{c.appealText}</p>
          {c.appealStatus && <div className="mt-3"><StatusBadge status={c.appealStatus} /></div>}
        </div>
      )}

      <StatusChanger c={c} actor={actor} onChanged={onStatusChanged} />

      <div className="card p-6">
        <p className="eyebrow">History</p>
        <h3 className="display-md text-ink-900 mt-1 mb-4">Full Audit Trail</h3>
        <div>
          {c.auditTrail.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-brand-600" />
                {i < c.auditTrail.length - 1 && <div className="w-px flex-1 bg-[var(--hairline-strong)] mt-1" />}
              </div>
              <div className="pb-4">
                <p className="text-sm text-ink-800">{entry.action}</p>
                <p className="text-xs text-ink-400 mt-0.5 tabular">{entry.by} · {entry.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-ink-700 mb-1.5">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
          <AlertCircle size={11} className="shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

/** Considered empty state: a muted mark, one bold line, one line of guidance. */
function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-ink-100 text-ink-400 flex items-center justify-center mx-auto mb-3.5">
        {icon}
      </div>
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {hint && <p className="text-[13px] text-ink-500 mt-1 max-w-sm mx-auto leading-relaxed">{hint}</p>}
    </div>
  );
}

function LoadingNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-ink-400">
      <Loader2 size={15} className="animate-spin shrink-0" />
      {children}
    </div>
  );
}

function ErrorNote({ message, className = '' }: { message: string; className?: string }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 ${className}`}>
      <AlertCircle size={15} className="shrink-0 mt-0.5" />
      <p className="text-[13px]">{message}</p>
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full rounded-xl border px-3.5 py-2.5 text-[13px] text-ink-800 placeholder-ink-400 outline-none
          transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
    hasError ? 'border-rose-300 bg-rose-50/50' : 'border-[var(--hairline-strong)] bg-white'
  }`;
}

// Focus is applied imperatively rather than with a `focus:` utility because the shared DepartmentSelect
// takes onFocus/onBlur handlers; both paths now resolve the same tokens as everything else.
function focusStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.boxShadow = 'var(--shadow-focus)';
  e.currentTarget.style.borderColor = 'var(--brand-400)';
}

function blurStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.boxShadow = '';
  e.currentTarget.style.borderColor = '';
}

function focusStyleSelect(e: React.FocusEvent<HTMLSelectElement>) {
  e.currentTarget.style.boxShadow = 'var(--shadow-focus)';
  e.currentTarget.style.borderColor = 'var(--brand-400)';
}

function blurStyleSelect(e: React.FocusEvent<HTMLSelectElement>) {
  e.currentTarget.style.boxShadow = '';
  e.currentTarget.style.borderColor = '';
}

/* ────────────────────────────────────────────────────────────
   AUDIT LOG — merged case + user-management feed
──────────────────────────────────────────────────────────── */

/**
 * Reads the server's merged feed rather than flat-mapping every case's audit trail in the browser.
 *
 * The old approach required the whole case list in memory, and could never have included
 * user-management actions — creating, editing or deleting an account left no trace anywhere until the
 * backend gained its own audit table.
 */
function AuditLog() {
  const [kind, setKind] = useState<'ALL' | 'CASE' | 'USER'>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(0);
  const [feed, setFeed] = useState<AuditFeedEntry[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [first, setFirst] = useState(true);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchAuditFeed({
      kind: kind === 'ALL' ? undefined : kind,
      search: debouncedSearch || undefined,
      page,
      size: 50,
    })
      .then(result => {
        if (!active) return;
        setFeed(result.content);
        setTotalPages(result.totalPages);
        setTotalElements(result.totalElements);
        setFirst(result.first);
        setLast(result.last);
      })
      .catch(err => active && setError(toMessage(err, 'Unable to load the audit log.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [kind, debouncedSearch, page]);

  // Narrowing while on a later page would otherwise land on one that no longer exists.
  useEffect(() => { setPage(0); }, [debouncedSearch]);

  const filters: { id: 'ALL' | 'CASE' | 'USER'; label: string }[] = [
    { id: 'ALL', label: 'Everything' },
    { id: 'CASE', label: 'Case activity' },
    { id: 'USER', label: 'User management' },
  ];

  return (
    <>
      <PageHeader
        title="System Audit Log"
        subtitle="Timestamped record of every case action and account change"
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-3xl mx-auto rise">
          <div className="mb-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search the audit log by action, user, or case reference…"
              resultCount={search ? totalElements : undefined}
              className={SEARCH_SHELL}
            />
          </div>

          <div className="flex gap-1.5 mb-5 flex-wrap">
            {filters.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setKind(f.id); setPage(0); }}
                aria-pressed={kind === f.id}
                className={chipCls(kind === f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            {loading && feed.length === 0 ? (
              <LoadingNote>Loading audit log…</LoadingNote>
            ) : error ? (
              <div className="p-6"><ErrorNote message={error} /></div>
            ) : feed.length === 0 ? (
              <EmptyState
                icon={<Clock size={20} />}
                title={search ? 'No matching entries' : 'Nothing recorded yet'}
                hint={search
                  ? `Nothing in the audit log matches "${search}".`
                  : 'Every case action and account change will be listed here as it happens.'}
              />
            ) : (
              <div className="divide-y divide-[var(--hairline)]">
                {feed.map(entry => (
                  <div key={`${entry.kind}-${entry.id}`}
                    className="flex items-start gap-4 px-6 py-4 hover:bg-brand-50/40 transition-colors duration-[var(--dur)]">
                    <span
                      className={`w-2 h-2 rounded-full mt-2 shrink-0 ${entry.kind === 'USER' ? 'bg-violet-500' : 'bg-brand-600'}`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Same row shape for both kinds — only the reference chip differs. */}
                        {entry.kind === 'CASE' ? (
                          <span className="text-[11px] font-mono tabular px-2 py-0.5 rounded-full
                                           bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                            {entry.caseId}
                          </span>
                        ) : (
                          <span className="text-[11px] font-tight font-medium px-2 py-0.5 rounded-full
                                           bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200/70">
                            {entry.targetUserName ?? 'Account'}
                          </span>
                        )}
                        <span className="text-sm text-ink-800">{entry.action}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-ink-400">{entry.by}</span>
                        <span className="text-ink-300">·</span>
                        <span className="text-xs text-ink-400 tabular">{entry.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              first={first}
              last={last}
              onPageChange={setPage}
              label="entry"
              labelPlural="entries"
            />
          </div>
        </div>
      </div>
    </>
  );
}
