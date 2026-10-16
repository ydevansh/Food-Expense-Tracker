import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../App';
import api from '../api';

export default function AdminLogin() {
  const { admin, loginAdmin, showToast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect to /admin
  useEffect(() => {
    if (admin) {
      const from = location.state?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    }
  }, [admin, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login({
        username: username.trim(),
        password
      });

      if (res.token) {
        localStorage.setItem('admin_token', res.token);
      }

      loginAdmin(res.admin);
      showToast(`Welcome back, ${res.admin.name || res.admin.username}! 🛡️`);
      navigate('/admin', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      const errMsg = err.response?.data?.error || 'Invalid username or password.';
      setError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container" style={{
      maxWidth: 440,
      margin: '40px auto',
      padding: '0 16px'
    }}>
      <div className="card-elevated" style={{
        padding: '32px 28px',
        borderRadius: 16,
        background: 'var(--bg-card, #1e1e2d)',
        border: '1px solid var(--border, #2d2d3f)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)'
      }}>
        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56,
            height: 56,
            margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)'
          }}>
            🔐
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
            Admin Login
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Enter administrator credentials to manage expenses, prices, and settlements.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: '#ef4444',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Username
            </label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. ydevansh"
              autoComplete="username"
              autoFocus
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 8,
                background: 'var(--bg-input, #13131e)',
                border: '1px solid var(--border, #2d2d3f)',
                color: 'var(--text-primary)',
                fontSize: 14
              }}
            />
          </div>

          {/* Password with Show/Hide button */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoComplete="current-password"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 48px 12px 14px',
                  borderRadius: 8,
                  background: 'var(--bg-input, #13131e)',
                  border: '1px solid var(--border, #2d2d3f)',
                  color: 'var(--text-primary)',
                  fontSize: 14
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide Password' : 'Show Password'}
                aria-label={showPassword ? 'Hide Password' : 'Show Password'}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '6px 8px',
                  fontSize: 16
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 8,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
            }}
          >
            {loading ? 'Authenticating...' : '🔐 Sign In to Admin Panel'}
          </button>
        </form>

        {/* Public Visitor Link */}
        <div style={{ textAlign: 'center', marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/')}
            style={{ color: 'var(--text-muted)', fontSize: 13 }}
          >
            ← Return to Public Website (Read-Only)
          </button>
        </div>
      </div>
    </div>
  );
}
