import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children, profile: propProfile }) {
  const { profile: authProfile, signOut } = useAuth();
  const profile = propProfile || authProfile;

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-brand">
          <span className="app-brand-title">Food Redistribution</span>
        </div>
        <div className="header-user-controls">
          {profile && (
            <span className="user-profile-badge">
              {profile.name} · {profile.role}
            </span>
          )}
          <button type="button" onClick={signOut} className="btn-secondary">
            Sign out
          </button>
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
