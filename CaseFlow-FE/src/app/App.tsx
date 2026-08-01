import { useEffect, useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { LecturerDashboard } from './components/LecturerDashboard';
import { CommitteeDashboard } from './components/CommitteeDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import type { AppUser, DisciplinaryCase } from './components/mockData';
import { fetchCases, fetchCurrentUser, hasStoredToken, logout, setUnauthorizedHandler, ApiError } from '../lib/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [cases, setCases] = useState<DisciplinaryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setUnauthorizedHandler(() => setCurrentUser(null));
    restoreSession();
  }, []);

  async function restoreSession() {
    setLoading(true);
    setLoadError('');
    try {
      if (hasStoredToken()) {
        const user = await fetchCurrentUser();
        setCurrentUser(user);
        setCases(await fetchCases());
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

  async function handleLogin(user: AppUser) {
    setLoadError('');
    try {
      const fetchedCases = await fetchCases();
      setCurrentUser(user);
      setCases(fetchedCases);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : 'Could not reach the CaseFlow server. Is the backend running?'
      );
    }
  }

  function handleLogout() {
    logout();
    setCurrentUser(null);
    setCases([]);
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

  const sharedProps = {
    cases,
    setCases,
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
