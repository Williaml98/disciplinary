import { useEffect, useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { LecturerDashboard } from './components/LecturerDashboard';
import { CommitteeDashboard } from './components/CommitteeDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import type { AppUser, DisciplinaryCase } from './components/mockData';
import { fetchUsers, fetchCases, ApiError } from '../lib/api';

export default function App() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [cases, setCases] = useState<DisciplinaryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setLoadError('');
    try {
      const [fetchedUsers, fetchedCases] = await Promise.all([fetchUsers(), fetchCases()]);
      setUsers(fetchedUsers);
      setCases(fetchedCases);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : 'Could not reach the CaseFlow server. Is the backend running?'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleRegister(newUser: AppUser) {
    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
  }

  function handleUpdateProfile(updated: AppUser) {
    setCurrentUser(updated);
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
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
            onClick={loadInitialData}
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
        users={users}
        onLogin={setCurrentUser}
        onRegister={handleRegister}
      />
    );
  }

  const sharedProps = {
    cases,
    setCases,
    onLogout: () => setCurrentUser(null),
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
      return <AdminDashboard {...sharedProps} user={currentUser} users={users} setUsers={setUsers} />;
    default:
      return <LoginPage users={users} onLogin={setCurrentUser} onRegister={handleRegister} />;
  }
}
