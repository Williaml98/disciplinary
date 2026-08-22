import { useEffect, useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { LecturerDashboard } from './components/LecturerDashboard';
import { CommitteeDashboard } from './components/CommitteeDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import type { AppUser } from './components/mockData';
import { fetchCurrentUser, hasStoredToken, logout, setUnauthorizedHandler, ApiError } from '../lib/api';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <>
      <AppScreens />
      {/* Mounted outside the screen switch so a toast fired during a screen change still lands. */}
      <Toaster />
    </>
  );
}

function AppScreens() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setUnauthorizedHandler(() => setCurrentUser(null));
    restoreSession();
  }, []);

  // Cases are no longer fetched here. Each dashboard queries the slice it needs through
  // usePagedCases, because the four roles want disjoint slices (own cases / cases I filed / the review
  // queue / everything) and no single global fetch serves all of them without being unbounded.
  async function restoreSession() {
    setLoading(true);
    setLoadError('');
    try {
      if (hasStoredToken()) {
        setCurrentUser(await fetchCurrentUser());
      }
    } catch (err) {
      // A 401 here just means the stored token expired — setUnauthorizedHandler already
      // reset currentUser to null, so this isn't a real error worth surfacing.
      if (!(err instanceof ApiError && err.status === 401)) {
        setLoadError(
          err instanceof ApiError ? err.message : 'Could not reach the CaseFlow server. Is the backend running?'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(user: AppUser) {
    setLoadError('');
    setCurrentUser(user);
  }

  function handleLogout() {
    logout();
    setCurrentUser(null);
  }

  function handleUpdateProfile(updated: AppUser) {
    setCurrentUser(updated);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading CaseFlow…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm text-red-600 mb-3">{loadError}</p>
          <button
            onClick={restoreSession}
            className="text-sm text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#1D3A5F' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onRegister={handleLogin}
      />
    );
  }

  // Accounts an admin created start with a generated temporary password that was emailed to the user;
  // it must be replaced before they reach the app, so this gate comes before the role switch.
  if (currentUser.mustChangePassword) {
    return (
      <ForcePasswordChange
        user={currentUser}
        onChanged={handleUpdateProfile}
        onLogout={handleLogout}
      />
    );
  }

  const sharedProps = {
    onLogout: handleLogout,
    onUpdateProfile: handleUpdateProfile,
  };

  switch (currentUser.role) {
    case 'lecturer':
      return <LecturerDashboard {...sharedProps} user={currentUser} />;
    case 'committee':
      return <CommitteeDashboard {...sharedProps} user={currentUser} />;
    case 'student':
      return <StudentDashboard {...sharedProps} user={currentUser} />;
    case 'admin':
      return <AdminDashboard {...sharedProps} user={currentUser} />;
    default:
      return <LoginPage onLogin={handleLogin} onRegister={handleLogin} />;
  }
}
