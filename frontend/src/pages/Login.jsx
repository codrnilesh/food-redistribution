import React, { useState } from 'react';
import supabase from '../lib/supabase';
import { apiPost } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { reloadProfile, startSignUp, endSignUp } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('donor');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleToggle = (signUpMode) => {
    setIsSignUp(signUpMode);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      if (!isSignUp) {
        // Log in flow
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setSubmitting(false);
          return;
        }

        // AuthContext onAuthStateChange will handle session & profile update
        setSubmitting(false);
      } else {
        // Sign up flow
        if (!name.trim()) {
          setError('Name is required');
          setSubmitting(false);
          return;
        }

        startSignUp?.();

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          endSignUp?.();
          setError(signUpError.message);
          setSubmitting(false);
          return;
        }

        // If session was not immediately returned by signUp, attempt to sign in to obtain session
        if (!signUpData?.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (signInError) {
            endSignUp?.();
            setError(signInError.message || 'Registration completed. Please sign in or check your email.');
            setSubmitting(false);
            return;
          }
        }

        // Immediately create backend profile
        const profilePayload = {
          role,
          name: name.trim(),
        };
        if (phone.trim()) {
          profilePayload.phone = phone.trim();
        }

        try {
          await apiPost('/auth/profile', profilePayload);
          await reloadProfile();
        } catch (err) {
          // If backend profile creation fails, sign out so the user stays on Login and sees the error in the red box
          await supabase.auth.signOut();
          endSignUp?.();
          setError(err.message || 'Failed to create profile');
        } finally {
          setSubmitting(false);
        }
      }
    } catch (err) {
      endSignUp?.();
      setError(err.message || 'An unexpected error occurred');
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h2>{isSignUp ? 'Create an Account' : 'Welcome Back'}</h2>
        <p>{isSignUp ? 'Join the food redistribution network' : 'Sign in to access your dashboard'}</p>
      </div>

      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!isSignUp}
          className={`tab-btn ${!isSignUp ? 'active' : ''}`}
          onClick={() => handleToggle(false)}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignUp}
          className={`tab-btn ${isSignUp ? 'active' : ''}`}
          onClick={() => handleToggle(true)}
        >
          Sign up
        </button>
      </div>

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form" noValidate={false}>
        {isSignUp && (
          <>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={submitting}
              >
                <option value="donor">Donor</option>
                <option value="recipient">Recipient</option>
                <option value="volunteer">Volunteer</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number (optional)</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                disabled={submitting}
              />
            </div>
          </>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={submitting}
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={submitting}
        >
          {submitting ? 'Please wait…' : (isSignUp ? 'Sign up' : 'Log in')}
        </button>
      </form>
    </div>
  );
}
