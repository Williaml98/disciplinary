import { useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { LecturerDashboard } from './components/LecturerDashboard';
import { CommitteeDashboard } from './components/CommitteeDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { INITIAL_CASES, DEMO_USERS, type AppUser, type DisciplinaryCase } from './components/mockData';

export default function App() {
  const [users, setUsers] = useState<AppUser[]>(DEMO_USERS);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [cases, setCases] = useState<DisciplinaryCase[]>(INITIAL_CASES);

  function handleRegister(newUser: AppUser) {
    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
  }

  function handleUpdateProfile(updated: AppUser) {
    setCurrentUser(updated);
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
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
