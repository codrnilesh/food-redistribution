import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

function AppContent() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="status-container">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (session && !profile) {
    return (
      <div className="status-container missing-profile-card">
        <p>Profile missing — please sign up again or contact admin</p>
        <button type="button" onClick={signOut} className="btn-secondary">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="status-container welcome-card">
      <h2>Welcome {profile.name} ({profile.role})</h2>
      <button type="button" onClick={signOut} className="btn-secondary">
        Sign out
      </button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
