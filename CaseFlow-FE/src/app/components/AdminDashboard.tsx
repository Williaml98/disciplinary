import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LayoutDashboard, AlertTriangle, List, Clock, Search, ChevronRight, Bell, UserCog, Plus, Eye, EyeOff, CheckCircle, AlertCircle, BookOpen, Users, GraduationCap, Settings, Pencil, X, Scale } from 'lucide-react';
import { DashboardLayout, PageHeader, StatusBadge, EvidenceGallery } from './DashboardLayout';
import { DisciplinaryRulesPage } from './DisciplinaryRulesPage';
import type { AppUser, DisciplinaryCase, Role } from './mockData';
import { createUser, updateUserRole, deleteUser as apiDeleteUser, ApiError } from '../../lib/api';

interface Props {
  user: AppUser;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  cases: DisciplinaryCase[];
  onLogout: () => void;
  onUpdateProfile: (updated: AppUser) => void;
}

const MONTHLY_DATA = [
  { month: 'Nov 25', cases: 1 },
  { month: 'Dec 25', cases: 0 },
  { month: 'Jan 26', cases: 0 },
  { month: 'Feb 26', cases: 0 },
  { month: 'Mar 26', cases: 0 },
  { month: 'Apr 26', cases: 0 },
  { month: 'May 26', cases: 1 },
  { month: 'Jun 26', cases: 5 },
];

const PIE_COLORS = ['#0058B8', '#f59e0b', '#f97316', '#a855f7', '#22c55e'];

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

const ROLE_COLORS: Record<Role, string> = {
  lecturer: 'bg-blue-50 text-blue-700 border-blue-200',
  committee: 'bg-slate-100 text-slate-700 border-slate-200',
  student: 'bg-teal-50 text-teal-700 border-teal-200',
  admin: 'bg-[#0058B8]/10 text-[#0058B8] border-[#0058B8]/20',
};

export function AdminDashboard({ user, users, setUsers, cases, onLogout, onUpdateProfile }: Props) {
  const [activeNav, setActiveNav] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedCase, setSelectedCase] = useState<DisciplinaryCase | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const activeSuspensions = cases.filter(c => c.registrationStatus === 'Restricted' && c.suspensionEnd && c.suspensionEnd >= today);
  const expiredSuspensions = cases.filter(c => c.registrationStatus === 'Restricted' && c.suspensionEnd && c.suspensionEnd < today);
  const flaggedStudents = cases.filter(c => c.registrationStatus === 'Flagged');
  const openCases = cases.filter(c => c.status !== 'Resolved');

  const statusCounts = {
    Reported: cases.filter(c => c.status === 'Reported').length,
    'Under Review': cases.filter(c => c.status === 'Under Review').length,
    Decided: cases.filter(c => c.status === 'Decided').length,
    'Under Appeal': cases.filter(c => c.status === 'Under Appeal').length,
    Resolved: cases.filter(c => c.status === 'Resolved').length,
  };

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const filteredCases = cases.filter(c => {
    const matchSearch = !searchQuery ||
      c.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.studentId.includes(searchQuery) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const alertBadge = activeSuspensions.length + expiredSuspensions.length + flaggedStudents.length;

  const navItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: <LayoutDashboard size={16} /> },
    { id: 'alerts', label: 'Registrar Alerts', icon: <Bell size={16} />, badge: alertBadge },
    { id: 'cases', label: 'All Cases', icon: <List size={16} /> },
    { id: 'users', label: 'User Management', icon: <UserCog size={16} /> },
    { id: 'audit', label: 'Audit Log', icon: <Clock size={16} /> },
    { id: 'rules', label: 'Disciplinary Rules', icon: <Scale size={16} /> },
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
              <StatCard label="Total Cases" value={cases.length} color="primary" />
              <StatCard label="Open Cases" value={openCases.length} color="amber" sub={`${statusCounts['Under Review']} under review`} />
              <StatCard label="Active Suspensions" value={activeSuspensions.length} color="red" sub="registration restricted" />
              <StatCard label="Registered Users" value={users.length} color="green" sub={`${users.filter(u => u.role === 'student').length} students`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 mb-6 sm:mb-8">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-5">Cases Reported by Month</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={MONTHLY_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                    <Bar dataKey="cases" name="Cases Reported" fill="#0058B8" radius={[4, 4, 0, 0]} />
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
                {cases.slice(0, 5).map(c => (
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
            {expiredSuspensions.length > 0 && (
              <AlertSection title="Suspension Ended — Awaiting Re-integration Clearance" color="red" items={expiredSuspensions}
                message="These students have served their suspension but have NOT yet been formally cleared. Their registration remains restricted. The committee must approve re-integration." />
            )}
            {activeSuspensions.length > 0 && (
              <AlertSection title="Active Suspensions — Registration Blocked" color="orange" items={activeSuspensions}
                message="These students are currently under suspension and must NOT be permitted to register for any courses." />
            )}
            {flaggedStudents.length > 0 && (
              <AlertSection title="Pending Cases — Registration Flagged" color="amber" items={flaggedStudents}
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
          <PageHeader title="All Cases" subtitle={`${filteredCases.length} case${filteredCases.length !== 1 ? 's' : ''} found`} />
          {selectedCase ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <button onClick={() => setSelectedCase(null)} className="text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors">← Back to cases</button>
              <AdminCaseDetail c={selectedCase} />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, ID, or case number..."
                    className="flex-1 text-sm border-0 outline-none text-gray-700 placeholder-gray-400 min-w-0" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {['All', 'Reported', 'Under Review', 'Decided', 'Under Appeal', 'Resolved'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-colors whitespace-nowrap ${statusFilter === s ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      style={statusFilter === s ? { backgroundColor: '#0058B8' } : {}}>
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
                    {filteredCases.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-gray-500">{c.id}</td>
                        <td className="px-6 py-4"><p className="text-sm text-gray-900">{c.studentName}</p><p className="text-xs text-gray-400">ID: {c.studentId}</p></td>
                        <td className="px-6 py-4 text-sm text-gray-600">{c.offenseType}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{c.reportDate}</td>
                        <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                        <td className="px-6 py-4">{c.decision ? <StatusBadge status={c.decision} /> : <span className="text-gray-300 text-xs">—</span>}</td>
                        <td className="px-6 py-4"><StatusBadge status={c.registrationStatus} /></td>
                        <td className="px-6 py-4">
                          <button onClick={() => setSelectedCase(c)} className="hover:opacity-70 transition-opacity" style={{ color: '#0058B8' }}>
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredCases.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No cases match your search.</div>}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── USER MANAGEMENT ── */}
      {activeNav === 'users' && (
        <UserManagement currentAdmin={user} users={users} setUsers={setUsers} />
      )}

      {/* ── AUDIT LOG ── */}
      {activeNav === 'audit' && (
        <>
          <PageHeader title="System Audit Log" subtitle="Complete timestamped log of all actions across every case" />
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {cases.flatMap(c => c.auditTrail.map(e => ({ ...e, caseId: c.id }))).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((entry, i) => (
                  <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50">
                    <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: '#0058B8' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#0058B814', color: '#0058B8' }}>{entry.caseId}</span>
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
            </div>
          </div>
        </>
      )}

      {activeNav === 'rules' && <DisciplinaryRulesPage />}
    </DashboardLayout>
  );
}

/* ────────────────────────────────────────────────────────────
   USER MANAGEMENT PANEL
──────────────────────────────────────────────────────────── */
function UserManagement({ currentAdmin, users, setUsers }: {
  currentAdmin: AppUser;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [toast, setToast] = useState('');
  const [toastKind, setToastKind] = useState<'success' | 'error'>('success');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  function showToast(msg: string, kind: 'success' | 'error' = 'success') {
    setToast(msg);
    setToastKind(kind);
    setTimeout(() => setToast(''), 3000);
  }

  async function changeRole(userId: string, newRole: Role) {
    setBusyUserId(userId);
    try {
      const updated = await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? updated : u));
      setEditingUserId(null);
      showToast('Role updated successfully.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to update role.', 'error');
    } finally {
      setBusyUserId(null);
    }
  }

  async function deleteUser(userId: string) {
    if (userId === currentAdmin.id) return;
    setBusyUserId(userId);
    try {
      await apiDeleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast('Account removed.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to remove account.', 'error');
    } finally {
      setBusyUserId(null);
    }
  }

  function handleCreate(newUser: AppUser) {
    setUsers(prev => [...prev, newUser]);
    setShowCreateForm(false);
    showToast(`Account created for ${newUser.name}.`);
  }

  const filtered = users.filter(u => {
    const matchSearch = !searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = {
    all: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    committee: users.filter(u => u.role === 'committee').length,
    lecturer: users.filter(u => u.role === 'lecturer').length,
    student: users.filter(u => u.role === 'student').length,
  };

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle={`${users.length} account${users.length !== 1 ? 's' : ''} registered`}
        action={
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#0058B8' }}>
            <Plus size={15} /> Create Account
          </button>
        }
      />

      {/* Toast */}
      {toast && (
        <div className={`mx-8 mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
          toastKind === 'error' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          {toastKind === 'error'
            ? <AlertCircle size={14} className="text-red-600 shrink-0" />
            : <CheckCircle size={14} className="text-green-600 shrink-0" />}
          {toast}
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="flex-1 text-sm border-0 outline-none text-gray-700 placeholder-gray-400 min-w-0" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'admin', 'committee', 'lecturer', 'student'] as const).map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors whitespace-nowrap ${roleFilter === r ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={roleFilter === r ? { backgroundColor: '#0058B8' } : {}}>
                {r === 'all' ? `All (${roleCounts.all})` : r === 'committee' ? `Committee (${roleCounts.committee})` : `${ROLE_LABELS[r]} (${roleCounts[r]})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                {['User', 'Email', 'Role', 'Additional Info', 'Actions'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0" style={{ backgroundColor: '#0058B8' }}>
                        {u.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <p className="text-sm text-gray-900">{u.name}</p>
                        {u.id === currentAdmin.id && <p className="text-xs text-gray-400">(you)</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                  <td className="px-6 py-4">
                    {editingUserId === u.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={u.role}
                          disabled={busyUserId === u.id}
                          onChange={e => changeRole(u.id, e.target.value as Role)}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                          onFocus={focusStyleSelect}
                          onBlur={blurStyleSelect}
                          autoFocus
                        >
                          {ROLE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button onClick={() => setEditingUserId(null)} className="text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${ROLE_COLORS[u.role]}`}>
                        {u.role === 'lecturer' && <BookOpen size={11} />}
                        {u.role === 'committee' && <Users size={11} />}
                        {u.role === 'student' && <GraduationCap size={11} />}
                        {u.role === 'admin' && <Settings size={11} />}
                        {ROLE_LABELS[u.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {u.studentId && <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">ID: {u.studentId}</span>}
                    {u.department && <span className="text-xs text-gray-500">{u.department}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {u.id !== currentAdmin.id && editingUserId !== u.id && (
                        <>
                          <button onClick={() => setEditingUserId(u.id)} disabled={busyUserId === u.id}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0058B8] disabled:opacity-60 transition-colors">
                            <Pencil size={12} /> Change Role
                          </button>
                          <button onClick={() => deleteUser(u.id)} disabled={busyUserId === u.id}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-60 transition-colors">
                            {busyUserId === u.id ? 'Removing…' : 'Remove'}
                          </button>
                        </>
                      )}
                      {u.id === currentAdmin.id && (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No users match your search.</div>}
        </div>
      </div>

      {/* Create account slide-over */}
      {showCreateForm && (
        <CreateAccountModal users={users} onCreate={handleCreate} onClose={() => setShowCreateForm(false)} />
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────
   CREATE ACCOUNT MODAL
──────────────────────────────────────────────────────────── */
function CreateAccountModal({ users, onCreate, onClose }: {
  users: AppUser[];
  onCreate: (user: AppUser) => void;
  onClose: () => void;
}) {
  const [form, setFormState] = useState({ name: '', email: '', role: '' as Role | '', studentId: '', department: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
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
    else if (users.some(u => u.email.toLowerCase() === form.email.trim().toLowerCase())) e.email = 'Email already in use.';
    if (!form.role) e.role = 'Please select a role.';
    if (isStudent && !form.studentId.trim()) e.studentId = 'Student ID is required.';
    if (needsDept && !form.department.trim()) e.department = 'Department is required.';
    if (!form.password) e.password = 'Password is required.';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters.';
    if (form.confirmPassword !== form.password) e.confirmPassword = 'Passwords do not match.';
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
        password: form.password,
        ...(isStudent ? { studentId: form.studentId.trim() } : {}),
        ...(needsDept ? { department: form.department.trim() } : {}),
      });
      onCreate(newUser);
    } catch (err) {
      setErrors({ email: err instanceof ApiError ? err.message : 'Unable to create account. Please try again.' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200" style={{ backgroundColor: '#0058B8' }}>
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
                      form.role === opt.value ? 'border-[#0058B8] bg-[#0058B8]/5 text-[#0058B8]' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
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

            {needsDept && (
              <ModalField label="Department" error={errors.department}>
                <input type="text" value={form.department} onChange={e => set('department', e.target.value)}
                  placeholder="e.g. Computer Science" className={inputCls(!!errors.department)}
                  onFocus={focusStyle} onBlur={blurStyle} />
              </ModalField>
            )}

            <ModalField label="Password" error={errors.password}>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="Minimum 8 characters"
                  className={inputCls(!!errors.password) + ' pr-11'} onFocus={focusStyle} onBlur={blurStyle} />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </ModalField>

            <ModalField label="Confirm Password" error={errors.confirmPassword}>
              <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                placeholder="Re-enter password" className={inputCls(!!errors.confirmPassword)}
                onFocus={focusStyle} onBlur={blurStyle} />
            </ModalField>

            <div className="pt-2 space-y-2">
              <button type="submit" disabled={creating} className="w-full text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity" style={{ backgroundColor: '#0058B8' }}>
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

/* ── helpers ── */
function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    primary: { bg: '#0058B80d', text: '#0058B8' },
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

function AlertSection({ title, color, items, message }: { title: string; color: string; items: DisciplinaryCase[]; message: string }) {
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
        <p className={`text-sm font-semibold ${s.text}`}>{title} ({items.length})</p>
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

function AdminCaseDetail({ c }: { c: DisciplinaryCase }) {
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
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Full Audit Trail</p>
        <div className="space-y-3">
          {c.auditTrail.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: '#0058B8' }} />
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
  e.currentTarget.style.boxShadow = '0 0 0 2px #0058B840';
  e.currentTarget.style.borderColor = '#0058B8';
}

function blurStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.boxShadow = '';
  e.currentTarget.style.borderColor = '';
}

function focusStyleSelect(e: React.FocusEvent<HTMLSelectElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 2px #0058B840';
  e.currentTarget.style.borderColor = '#0058B8';
}

function blurStyleSelect(e: React.FocusEvent<HTMLSelectElement>) {
  e.currentTarget.style.boxShadow = '';
  e.currentTarget.style.borderColor = '';
}
