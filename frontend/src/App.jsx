import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import DonorDashboard from './pages/DonorDashboard';
import RecipientDashboard from './pages/RecipientDashboard';
import VolunteerView from './pages/VolunteerView';
import AdminConsole from './pages/AdminConsole';
import ErrorBoundary from './components/ErrorBoundary';

function renderRolePage(role) {
  switch (role?.toLowerCase()) {
    case 'donor':
      return <DonorDashboard />;
    case 'recipient':
      return <RecipientDashboard />;
    case 'volunteer':
      return <VolunteerView />;
    case 'admin':
      return <AdminConsole />;
    default:
      return <h2>Unknown role: {role}</h2>;
  }
}

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
    <Layout>
      <ErrorBoundary>
        {renderRolePage(profile.role)}
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
