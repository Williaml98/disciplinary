import { useState } from 'react';
import { LogOut, Menu, X, UserCircle } from 'lucide-react';
import type { AppUser } from './mockData';
import { ProfilePage } from './ProfilePage';
import logo from '../../imports/logo.png';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface DashboardLayoutProps {
  user: AppUser;
  onLogout: () => void;
  onUpdateProfile: (updated: AppUser) => void;
  navItems: NavItem[];
  activeNav: string;
  onNavChange: (id: string) => void;
  children: React.ReactNode;
}

const roleLabels = {
  lecturer: 'Lecturer / Invigilator',
  committee: 'Committee Member',
  student: 'Student',
  admin: 'Registrar / Admin',
};

export function DashboardLayout({ user, onLogout, onUpdateProfile, navItems, activeNav, onNavChange, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  function handleNavChange(id: string) {
    onNavChange(id);
    setSidebarOpen(false);
    setShowProfile(false);
  }

  function handleOpenProfile() {
    setShowProfile(true);
    setSidebarOpen(false);
  }

  function handleUpdateProfile(updated: AppUser) {
    onUpdateProfile(updated);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="AUCA Logo" className="w-10 h-10 rounded-full object-cover bg-white p-0.5 shrink-0" />
            <div>
              <p className="font-bold text-base leading-tight">CaseFlow</p>
              <p className="text-white/50 text-xs">AUCA Disciplinary System</p>
            </div>
          </div>
          <button className="lg:hidden text-white/60 hover:text-white ml-2" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* User card — clickable to open profile */}
        <button
          onClick={handleOpenProfile}
          className={`w-full text-left rounded-xl p-3 transition-colors group ${showProfile ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-white/30 transition-all">
              <span className="text-xs font-bold">{user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight truncate">{user.name}</p>
              <p className="text-white/50 text-xs mt-0.5">{roleLabels[user.role]}</p>
              {user.studentId && <p className="text-white/40 text-xs">ID: {user.studentId}</p>}
            </div>
            <UserCircle size={14} className="text-white/40 group-hover:text-white/70 shrink-0 transition-colors" />
          </div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavChange(item.id)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
              activeNav === item.id && !showProfile
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-white/65 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              {item.icon}
              {item.label}
            </span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="bg-red-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {/* My Profile nav item */}
        <button
          onClick={handleOpenProfile}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
            showProfile
              ? 'bg-white/20 text-white shadow-sm'
              : 'text-white/65 hover:bg-white/10 hover:text-white'
          }`}
        >
          <UserCircle size={16} />
          My Profile
        </button>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:bg-white/10 hover:text-white text-sm transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col text-white shrink-0
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:transition-none lg:z-auto
        `}
        style={{ backgroundColor: '#0058B8' }}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center justify-between px-4 py-3 text-white shrink-0"
          style={{ backgroundColor: '#0058B8' }}
        >
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="AUCA Logo" className="w-7 h-7 rounded-full bg-white p-0.5 object-cover" />
            <span className="font-semibold text-sm">CaseFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleOpenProfile} className="text-white/70 hover:text-white p-1">
              <UserCircle size={20} />
            </button>
            <button onClick={() => setSidebarOpen(true)} className="text-white/80 hover:text-white p-1">
              <Menu size={22} />
            </button>
          </div>
        </div>

        {/* Profile page or dashboard content */}
        {showProfile ? (
          <ProfilePage
            user={user}
            onUpdate={handleUpdateProfile}
            onClose={() => setShowProfile(false)}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 sm:py-5 flex items-start sm:items-center justify-between gap-3 shrink-0">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EvidenceGallery({ files }: { files: string[] }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {files.map((url, i) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-[#0058B8]/40 transition-colors shrink-0"
        >
          <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
        </a>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Reported': 'bg-gray-100 text-gray-700 border-gray-200',
    'Under Review': 'bg-amber-50 text-amber-700 border-amber-200',
    'Decided': 'bg-orange-50 text-orange-700 border-orange-200',
    'Under Appeal': 'bg-purple-50 text-purple-700 border-purple-200',
    'Resolved': 'bg-green-50 text-green-700 border-green-200',
    'Active': 'bg-green-50 text-green-700 border-green-200',
    'Restricted': 'bg-red-50 text-red-700 border-red-200',
    'Flagged': 'bg-amber-50 text-amber-700 border-amber-200',
    'Warning': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Probation': 'bg-orange-50 text-orange-700 border-orange-200',
    'Semester Suspension': 'bg-red-50 text-red-700 border-red-200',
    'Expulsion': 'bg-red-100 text-red-800 border-red-300',
    'Cleared': 'bg-green-50 text-green-700 border-green-200',
    'Pending': 'bg-blue-50 text-blue-700 border-blue-200',
    'Upheld': 'bg-red-50 text-red-700 border-red-200',
    'Overturned': 'bg-green-50 text-green-700 border-green-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${map[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}
