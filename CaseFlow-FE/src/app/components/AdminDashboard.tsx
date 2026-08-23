import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LayoutDashboard, AlertTriangle, List, Clock, ChevronRight, Bell, UserCog, Plus, AlertCircle, BookOpen, Users, GraduationCap, Settings, Pencil, Ban, RotateCcw, Mail, X, Scale, BarChart3 } from 'lucide-react';
import { DashboardLayout, PageHeader, StatusBadge, EvidenceGallery } from './DashboardLayout';
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

const PIE_COLORS = ['#1D3A5F', '#f59e0b', '#f97316', '#a855f7', '#22c55e'];

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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
              <StatCard label="Total Cases" value={stats.data?.total ?? 0} color="primary" />
              <StatCard label="Open Cases" value={stats.data?.open ?? 0} color="amber" sub={`${stats.data?.underReview ?? 0} under review`} />
              <StatCard label="Active Suspensions" value={stats.data?.activeSuspensions ?? 0} color="red" sub="registration restricted" />
              <StatCard label="Registered Users" value={userStats.data?.total ?? 0} color="green" sub={`${userStats.data?.student ?? 0} students`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 mb-6 sm:mb-8">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">Cases Reported by Month</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthly.data ?? []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                    <Bar dataKey="count" name="Cases Reported" fill="#1D3A5F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">Cases by Status</p>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pieData.filter(d => d.value > 0).map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[i] }} />
                        {d.name}
                      </span>
                      <span className="text-gray-600">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Recent Cases</p>
              <div className="space-y-2">
                {recentCases.items.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-gray-400 w-24">{c.id}</span>
                      <div>
                        <p className="text-sm text-gray-900">{c.studentName}</p>
                        <p className="text-xs text-gray-400">{c.offenseType} · {c.reportDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <StatusBadge status={c.registrationStatus} />
                    </div>
                  </div>
                ))}
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
              <div className="text-center py-16 text-gray-400">
                <Bell size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No active registrar alerts at this time.</p>
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
              <button onClick={() => setSelectedCase(null)} className="text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">← Back to cases</button>
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
              <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by student, ID, case number or offense…"
                  resultCount={searchQuery ? pagedCases.totalElements : undefined}
                  className="flex-1"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {['All', 'Reported', 'Under Review', 'Decided', 'Under Appeal', 'Resolved'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-colors whitespace-nowrap ${statusFilter === s ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      style={statusFilter === s ? { backgroundColor: '#1D3A5F' } : {}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      {['Case ID', 'Student', 'Offense', 'Reported', 'Status', 'Decision', 'Registration', ''].map(h => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {pagedCases.items.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-gray-500">{c.id}</td>
                        <td className="px-6 py-4"><p className="text-sm text-gray-900">{c.studentName}</p><p className="text-xs text-gray-400">ID: {c.studentId}</p></td>
                        <td className="px-6 py-4 text-sm text-gray-600">{c.offenseType}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{c.reportDate}</td>
                        <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                        <td className="px-6 py-4">{c.decision ? <StatusBadge status={c.decision} /> : <span className="text-gray-300 text-xs">—</span>}</td>
                        <td className="px-6 py-4"><StatusBadge status={c.registrationStatus} /></td>
                        <td className="px-6 py-4">
                          <button onClick={() => setSelectedCase(c)} className="hover:opacity-70 transition-opacity" style={{ color: '#1D3A5F' }}>
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pagedCases.loading && pagedCases.items.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">Loading cases…</div>
                )}
                {pagedCases.error && (
                  <div className="text-center py-12 text-red-600 text-sm">{pagedCases.error}</div>
                )}
                {!pagedCases.loading && !pagedCases.error && pagedCases.items.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">No cases match your search.</div>
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
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#1D3A5F' }}>
            <Plus size={15} /> Create Account
          </button>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name or email…"
            resultCount={searchQuery ? pageMeta.totalElements : undefined}
            className="flex-1"
          />
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'admin', 'committee', 'lecturer', 'student'] as const).map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors whitespace-nowrap ${roleFilter === r ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={roleFilter === r ? { backgroundColor: '#1D3A5F' } : {}}>
                {r === 'all' ? `All (${roleCounts.all})` : r === 'committee' ? `Committee (${roleCounts.committee})` : `${ROLE_LABELS[r]} (${roleCounts[r]})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                {['User', 'Email', 'Role', 'Additional Info', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${u.active ? '' : 'opacity-60'}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size={32} />
                      <div>
                        <p className="text-sm text-gray-900">{u.name}</p>
                        {u.id === currentAdmin.id && <p className="text-xs text-gray-400">(you)</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={u.role}
                      disabled={busyUserId === u.id || u.id === currentAdmin.id}
                      onChange={e => changeRole(u.id, e.target.value as Role)}
                      aria-label={`Role for ${u.name}`}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                      onFocus={focusStyleSelect}
                      onBlur={blurStyleSelect}
                    >
                      {ROLE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex flex-col gap-1">
                      {u.studentId && <span className="bg-gray-100 px-2 py-0.5 rounded text-xs w-fit">ID: {u.studentId}</span>}
                      {u.department && <span className="text-xs text-gray-500">{u.department}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                        <Ban size={10} /> Deactivated
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {u.id === currentAdmin.id ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => setEditingUser(u)} disabled={busyUserId === u.id}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1D3A5F] disabled:opacity-60 transition-colors">
                          <Pencil size={12} /> Edit
                        </button>
                        {/* Deactivation sits alongside delete, not in place of it: it's reversible and
                            keeps the account's name resolvable from the cases that reference it. */}
                        <button onClick={() => toggleActive(u)} disabled={busyUserId === u.id}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-600 disabled:opacity-60 transition-colors">
                          {u.active ? <><Ban size={12} /> Deactivate</> : <><RotateCcw size={12} /> Reactivate</>}
                        </button>
                        <button onClick={() => setDeleteTarget(u)} disabled={busyUserId === u.id}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-60 transition-colors">
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
            <div className="text-center py-12 text-gray-400 text-sm">Loading accounts…</div>
          )}
          {error && (
            <div className="mx-8 mt-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
          {!loading && !error && users.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No accounts match your search.</div>
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
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200" style={{ backgroundColor: '#1D3A5F' }}>
          <h2 className="text-white font-medium">Create New Account</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs transition-all text-left ${
                      form.role === opt.value ? 'border-[#1D3A5F] bg-[#1D3A5F]/5 text-[#1D3A5F]' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
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
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
              <Mail size={14} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                A welcome email with a temporary password will be sent to this address. They'll be asked
                to choose their own password the first time they sign in.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button type="submit" disabled={creating} className="w-full text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity" style={{ backgroundColor: '#1D3A5F' }}>
                {creating ? 'Creating Account…' : 'Create Account'}
              </button>
              <button type="button" onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 text-sm transition-colors">
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
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200" style={{ backgroundColor: '#1D3A5F' }}>
          <h2 className="text-white font-medium">Edit Account</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100">
            <Avatar user={user} size={40} />
            <div className="min-w-0">
              <p className="text-sm text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-400">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                Changing a student ID re-points which case this account can see. Only change it to
                correct a mistake.
              </p>
            )}

            <div className="pt-2 space-y-2">
              <button type="submit" disabled={saving}
                className="w-full text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: '#1D3A5F' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" onClick={onClose}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 text-sm transition-colors">
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={17} className="text-red-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">Delete {user.name}?</h2>
              <p className="text-sm text-gray-500 mt-0.5">This permanently removes the account. It cannot be undone.</p>
            </div>
          </div>

          {loadingImpact ? (
            <p className="text-sm text-gray-400 py-3">Checking what references this account…</p>
          ) : hasImpact && impact ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
                This account is referenced by existing records
              </p>
              <ul className="text-sm text-amber-900 space-y-1">
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
              <p className="text-xs text-amber-800 mt-2">
                Those records stay, but will point at a name with no account behind it. Deactivating keeps
                the link intact and blocks sign-in.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-4">
              <p className="text-sm text-gray-600">No cases or notes reference this account.</p>
            </div>
          )}

          <div className="space-y-2">
            {hasImpact && (
              <button onClick={onDeactivateInstead} disabled={busy}
                className="w-full rounded-xl py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: '#1D3A5F' }}>
                Deactivate instead (recommended)
              </button>
            )}
            <button onClick={onConfirm} disabled={busy}
              className="w-full rounded-xl py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white transition-colors">
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button onClick={onClose} disabled={busy}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 text-sm transition-colors">
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
  const styles: Record<string, { bg: string; text: string }> = {
    primary: { bg: '#1D3A5F0d', text: '#1D3A5F' },
    amber: { bg: '#fef3c70d', text: '#b45309' },
    red: { bg: '#fef2f20d', text: '#b91c1c' },
    green: { bg: '#f0fdf40d', text: '#15803d' },
  };
  const s = styles[color] || styles.primary;
  return (
    <div className="rounded-2xl border border-gray-200 p-5" style={{ backgroundColor: s.bg }}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-3xl" style={{ color: s.text }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function AlertSection({ title, color, items, total, message }: {
  title: string; color: string; items: DisciplinaryCase[]; total: number; message: string;
}) {
  const styles: Record<string, { wrap: string; text: string }> = {
    red: { wrap: 'border-red-200 bg-red-50', text: 'text-red-800' },
    orange: { wrap: 'border-orange-200 bg-orange-50', text: 'text-orange-800' },
    amber: { wrap: 'border-amber-200 bg-amber-50', text: 'text-amber-800' },
  };
  const s = styles[color];
  return (
    <div className={`rounded-2xl border ${s.wrap} p-6`}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className={s.text} />
        <p className={`text-sm font-semibold ${s.text}`}>{title} ({total})</p>
      </div>
      <p className={`text-xs mb-4 ${s.text} opacity-80`}>{message}</p>
      <div className="space-y-2">
        {items.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400">{c.id}</span>
                <span className="text-sm text-gray-900">{c.studentName}</span>
                <span className="text-xs text-gray-400">({c.studentId})</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>{c.offenseType}</span>
                {c.suspensionStart && <span>Suspension: {c.suspensionStart} → {c.suspensionEnd}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={c.status} />
              <StatusBadge status={c.registrationStatus} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminCaseDetail({ c, actor, onStatusChanged }: {
  c: DisciplinaryCase;
  actor: string;
  onStatusChanged: (updated: DisciplinaryCase) => void;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-mono text-gray-400 mb-1">{c.id}</p>
            <h2 className="text-lg text-gray-900">{c.studentName}</h2>
            <p className="text-sm text-gray-500">Student ID: {c.studentId} · {c.reporterDepartment}</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <StatusBadge status={c.status} />
            <StatusBadge status={c.registrationStatus} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-4">
          <div><span className="text-gray-500">Offense:</span> <span className="ml-1 text-gray-900">{c.offenseType}</span></div>
          <div><span className="text-gray-500">Reported:</span> <span className="ml-1 text-gray-900">{c.reportDate}</span></div>
          <div><span className="text-gray-500">Reported By:</span> <span className="ml-1 text-gray-900">{c.reportedBy}</span></div>
          {c.decision && <div><span className="text-gray-500">Decision:</span> <span className="ml-1"><StatusBadge status={c.decision} /></span></div>}
          {c.decisionDate && <div><span className="text-gray-500">Decision Date:</span> <span className="ml-1 text-gray-900">{c.decisionDate}</span></div>}
          {c.suspensionStart && <div><span className="text-gray-500">Suspension:</span> <span className="ml-1 text-gray-900">{c.suspensionStart} → {c.suspensionEnd}</span></div>}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Description</p>
        <p className="text-sm text-gray-700 leading-relaxed">{c.description}</p>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Evidence</p>
        <p className="text-sm text-gray-700">{c.evidence}</p>
        <EvidenceGallery files={c.evidenceFiles} />
      </div>
      {c.appealSubmitted && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Student Appeal</p>
          <p className="text-sm text-purple-900 leading-relaxed">{c.appealText}</p>
          {c.appealStatus && <div className="mt-2"><StatusBadge status={c.appealStatus} /></div>}
        </div>
      )}
      <StatusChanger c={c} actor={actor} onChanged={onStatusChanged} />

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Full Audit Trail</p>
        <div className="space-y-3">
          {c.auditTrail.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: '#1D3A5F' }} />
                {i < c.auditTrail.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
              </div>
              <div className="pb-3">
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

function ModalField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={11} className="shrink-0" /> {error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full border ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'} rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors`;
}

function focusStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 2px #1D3A5F40';
  e.currentTarget.style.borderColor = '#1D3A5F';
}

function blurStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.boxShadow = '';
  e.currentTarget.style.borderColor = '';
}

function focusStyleSelect(e: React.FocusEvent<HTMLSelectElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 2px #1D3A5F40';
  e.currentTarget.style.borderColor = '#1D3A5F';
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
        <div className="max-w-3xl mx-auto">
          <div className="mb-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search the audit log by action, user, or case reference…"
              resultCount={search ? totalElements : undefined}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2.5"
            />
          </div>

          <div className="flex gap-1.5 mb-4">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => { setKind(f.id); setPage(0); }}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  kind === f.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={kind === f.id ? { backgroundColor: '#1D3A5F' } : {}}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {loading && feed.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-gray-400">Loading audit log…</p>
            ) : error ? (
              <p className="px-6 py-12 text-center text-sm text-red-600">{error}</p>
            ) : feed.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-gray-400">
                {search ? `No audit entries match "${search}".` : 'Nothing recorded yet.'}
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {feed.map(entry => (
                  <div key={`${entry.kind}-${entry.id}`} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50">
                    <div
                      className="w-2 h-2 rounded-full mt-2 shrink-0"
                      style={{ backgroundColor: entry.kind === 'USER' ? '#a855f7' : '#1D3A5F' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Same row shape for both kinds — only the reference chip differs. */}
                        {entry.kind === 'CASE' ? (
                          <span className="text-xs font-mono px-2 py-0.5 rounded"
                            style={{ backgroundColor: '#1D3A5F14', color: '#1D3A5F' }}>
                            {entry.caseId}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                            {entry.targetUserName ?? 'Account'}
                          </span>
                        )}
                        <span className="text-sm text-gray-800">{entry.action}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{entry.by}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{entry.timestamp}</span>
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
