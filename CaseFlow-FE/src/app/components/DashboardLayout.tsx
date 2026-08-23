import { useState } from 'react';
import { LogOut, Menu, X, UserCircle, FileText } from 'lucide-react';
import type { AppUser } from './mockData';
import { Avatar } from './Avatar';
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
      {/* Wordmark */}
      <div className="p-5 border-b border-white/[0.08]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="AUCA" className="w-10 h-10 rounded-full object-cover bg-white p-0.5 shrink-0 ring-1 ring-white/20" />
            <div>
              <p className="display-md text-white leading-none">CaseFlow</p>
              <p className="text-brand-300/70 text-[10px] font-tight font-semibold uppercase tracking-[0.14em] mt-1.5">
                AUCA Disciplinary
              </p>
            </div>
          </div>
          <button
            className="lg:hidden text-white/50 hover:text-white ml-2 transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* User card — clickable to open profile */}
        <button
          onClick={handleOpenProfile}
          className={`w-full text-left rounded-xl p-3 group ring-1 transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
            showProfile
              ? 'bg-white/[0.14] ring-white/20'
              : 'bg-white/[0.06] ring-white/[0.08] hover:bg-white/[0.10] hover:ring-white/[0.16]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Avatar
              user={user}
              size={32}
              variant="translucent"
              className="group-hover:ring-2 group-hover:ring-white/30 transition-all"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight truncate text-white">{user.name}</p>
              <p className="text-brand-300/70 text-[11px] mt-0.5 truncate">{roleLabels[user.role]}</p>
              {user.studentId && <p className="text-white/35 text-[11px] font-mono mt-0.5">{user.studentId}</p>}
            </div>
            <UserCircle size={14} className="text-white/30 group-hover:text-white/60 shrink-0 transition-colors" />
          </div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavChange(item.id)}
            className={`relative w-full flex items-center justify-between gap-3 pl-3 pr-2.5 py-2.5 rounded-lg text-[13px] text-left
                        transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
              activeNav === item.id && !showProfile
                ? 'bg-white/[0.13] text-white font-semibold'
                : 'text-white/60 hover:bg-white/[0.07] hover:text-white/90'
            }`}
          >
            {/* Accent rail marks the active section without relying on fill alone. */}
            <span
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-brand-300
                          transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
                activeNav === item.id && !showProfile ? 'h-5 opacity-100' : 'h-0 opacity-0'
              }`}
            />
            <span className="flex items-center gap-3">
              <span className={activeNav === item.id && !showProfile ? 'text-brand-300' : 'text-white/45'}>
                {item.icon}
              </span>
              {item.label}
            </span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold font-tight px-1.5 py-0.5 rounded-full min-w-[19px] text-center tabular shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {/* My Profile nav item */}
        <button
          onClick={handleOpenProfile}
          className={`relative w-full flex items-center gap-3 pl-3 pr-2.5 py-2.5 rounded-lg text-[13px] text-left
                      transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
            showProfile
              ? 'bg-white/[0.13] text-white font-semibold'
              : 'text-white/60 hover:bg-white/[0.07] hover:text-white/90'
          }`}
        >
          <span
            className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-brand-300
                        transition-all duration-[var(--dur)] ease-[var(--ease-out)] ${
              showProfile ? 'h-5 opacity-100' : 'h-0 opacity-0'
            }`}
          />
          <span className={showProfile ? 'text-brand-300' : 'text-white/45'}><UserCircle size={16} /></span>
          My Profile
        </button>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/[0.08]">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-white/[0.07] hover:text-white/90 text-[13px] transition-all duration-[var(--dur)] ease-[var(--ease-out)]"
        >
          <span className="text-white/40"><LogOut size={16} /></span>
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-page overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[264px] flex flex-col text-white shrink-0
          transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:transition-none lg:z-auto
        `}
        // Vertical gradient rather than a flat fill: it gives the rail depth and stops the sidebar
        // reading as a single block of colour next to the warm page.
        style={{ background: 'linear-gradient(175deg, var(--brand-800) 0%, var(--brand-900) 55%, var(--brand-950) 100%)' }}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center justify-between px-4 py-3 text-white shrink-0"
          style={{ background: 'linear-gradient(100deg, var(--brand-800), var(--brand-900))' }}
        >
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="AUCA" className="w-7 h-7 rounded-full bg-white p-0.5 object-cover ring-1 ring-white/20" />
            <span className="display-md text-white">CaseFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleOpenProfile} className="text-white/70 hover:text-white p-1" aria-label="Open profile">
              {user.profilePictureUrl
                ? <Avatar user={user} size={24} variant="translucent" />
                : <UserCircle size={20} />}
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
    <div className="bg-[var(--surface-card)]/85 backdrop-blur-xl border-b border-[var(--hairline)] px-4 sm:px-8 py-4 sm:py-5 flex items-start sm:items-center justify-between gap-4 shrink-0 sticky top-0 z-20">
      <div className="min-w-0">
        <h1 className="display-lg text-ink-900 truncate">{title}</h1>
        {subtitle && <p className="text-[13px] text-ink-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Primary action button. Exists so the navy-pill-with-icon pattern that was pasted into eight
 * components has one definition — and so its hover, press and disabled states are considered rather
 * than a bare `hover:opacity-90`.
 */
export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white
                  bg-brand-700 shadow-[var(--shadow-sm)]
                  transition-[background-color,box-shadow,transform] duration-[var(--dur)] ease-[var(--ease-out)]
                  hover:bg-brand-800 hover:shadow-[var(--shadow-md)]
                  active:translate-y-px active:shadow-[var(--shadow-xs)]
                  disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none disabled:cursor-not-allowed
                  ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Evidence thumbnails. `files` are already absolute URLs — api.ts prefixes the API origin onto the
 * relative path the backend returns, so nothing here needs to know where the backend lives.
 *
 * PDFs are allowed as evidence alongside images, and an <img> cannot render one, so non-image
 * attachments get a document card instead.
 */
export function EvidenceGallery({ files }: { files: string[] }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {files.map((url, i) => (
        <EvidenceThumbnail key={url} url={url} index={i} />
      ))}
    </div>
  );
}

function EvidenceThumbnail({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const isPdf = url.toLowerCase().endsWith('.pdf');

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={isPdf ? `Evidence document ${index + 1} (PDF)` : `Evidence ${index + 1}`}
      className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-[#1D3A5F]/40 transition-colors shrink-0"
    >
      {isPdf || failed ? (
        // Also covers a file that 404s or fails to decode: a labelled card is more useful than the
        // browser's broken-image glyph, which gives the viewer nothing to act on.
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-50 text-gray-500">
          <FileText size={20} />
          <span className="text-[10px] font-medium">{isPdf ? 'PDF' : 'Unavailable'}</span>
        </div>
      ) : (
        <img
          src={url}
          alt={`Evidence ${index + 1}`}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      )}
    </a>
  );
}

export function StatusBadge({ status }: { status: string }) {
  // Each status gets a tint, a text tone and a dot. The dot is what lets these read at a glance in a
  // dense table — colour alone on a small pill is hard to distinguish, and it carries the meaning for
  // anyone who can't separate the hues.
  const map: Record<string, { cls: string; dot: string }> = {
    'Reported':            { cls: 'bg-ink-100 text-ink-700 ring-ink-200', dot: 'bg-ink-400' },
    'Under Review':        { cls: 'bg-amber-50 text-amber-800 ring-amber-200/70', dot: 'bg-amber-500' },
    'Decided':             { cls: 'bg-brand-50 text-brand-800 ring-brand-200', dot: 'bg-brand-500' },
    'Under Appeal':        { cls: 'bg-violet-50 text-violet-800 ring-violet-200/70', dot: 'bg-violet-500' },
    'Resolved':            { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70', dot: 'bg-emerald-500' },
    'Active':              { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70', dot: 'bg-emerald-500' },
    'Restricted':          { cls: 'bg-rose-50 text-rose-800 ring-rose-200/70', dot: 'bg-rose-500' },
    'Flagged':             { cls: 'bg-amber-50 text-amber-800 ring-amber-200/70', dot: 'bg-amber-500' },
    'Warning':             { cls: 'bg-yellow-50 text-yellow-800 ring-yellow-200/70', dot: 'bg-yellow-500' },
    'Probation':           { cls: 'bg-orange-50 text-orange-800 ring-orange-200/70', dot: 'bg-orange-500' },
    'Semester Suspension': { cls: 'bg-rose-50 text-rose-800 ring-rose-200/70', dot: 'bg-rose-500' },
    'Expulsion':           { cls: 'bg-rose-100 text-rose-900 ring-rose-300/70', dot: 'bg-rose-700' },
    'Cleared':             { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70', dot: 'bg-emerald-500' },
    'Pending':             { cls: 'bg-brand-50 text-brand-800 ring-brand-200', dot: 'bg-brand-400' },
    'Upheld':              { cls: 'bg-rose-50 text-rose-800 ring-rose-200/70', dot: 'bg-rose-500' },
    'Overturned':          { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70', dot: 'bg-emerald-500' },
  };
  const tone = map[status] ?? { cls: 'bg-ink-100 text-ink-600 ring-ink-200', dot: 'bg-ink-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-0.5 rounded-full text-[11px] font-semibold
                      ring-1 ring-inset whitespace-nowrap font-tight ${tone.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
      {status}
    </span>
  );
}
