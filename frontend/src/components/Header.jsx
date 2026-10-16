import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../App';

export default function Header({ title }) {
  const { admin, isAdmin, logoutAdmin, showToast } = useApp();
  const navigate  = useNavigate();
  const location  = useLocation();
  const path      = location.pathname;
  const showBack  = path !== '/' && path !== '/admin';

  const isActive = (p) => path === p || (p !== '/' && path.startsWith(p));

  // Public navigation vs Admin navigation
  const navItems = isAdmin ? [
    { path: '/',           label: 'Dashboard',   icon: '📊' },
    { path: '/calendar',   label: 'Calendar',    icon: '📅' },
    { path: '/add',        label: 'Add Expense', icon: '➕' },
    { path: '/history',    label: 'History',     icon: '📜' },
    { path: '/settlement', label: 'Settlement',  icon: '💰' },
    { path: '/reports',    label: 'Reports',     icon: '📈' },
    { path: '/settings',   label: 'Settings',    icon: '⚙️' },
    { path: '/admin',      label: 'Admin Panel', icon: '🛡️' },
  ] : [
    { path: '/',           label: 'Dashboard',   icon: '📊' },
    { path: '/calendar',   label: 'Calendar',    icon: '📅' },
    { path: '/history',    label: 'History',     icon: '📜' },
    { path: '/reports',    label: 'Reports',     icon: '📈' },
    { path: '/admin/login',label: 'Admin Login', icon: '🔐' },
  ];

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Left: Logo & Back */}
        <div className="header-brand" onClick={() => navigate(isAdmin ? '/admin' : '/')}>
          <span className="header-logo">🍽️</span>
          <span className="brand-text">
            <span className="brand-title">Food Expense Tracker</span>
            <span className="brand-badge">
              {isAdmin ? '🛡️ Admin Mode' : '3 Roommates'}
            </span>
          </span>
        </div>

        {/* Mobile Page Title & Back Button */}
        <div className="mobile-header-title">
          {showBack && (
            <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
          <h1 className="header-title">{title}</h1>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="desktop-nav" aria-label="Desktop navigation">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                type="button"
                className={`desktop-nav-link ${active ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="desktop-nav-icon">{item.icon}</span>
                <span className="desktop-nav-text">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="header-actions">
          {isAdmin ? (
            <>
              <button
                className="btn btn-primary btn-sm desktop-add-btn"
                onClick={() => navigate('/add')}
              >
                + Add Expense
              </button>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 20
                }}
                title="Open Admin Panel"
              >
                <span>🛡️</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#a5b4fc' }}>
                  {admin?.username || 'Admin'}
                </span>
              </button>

              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await logoutAdmin();
                  showToast('Logged out');
                  navigate('/');
                }}
                title="Sign out of admin"
                style={{ color: 'var(--text-muted)' }}
              >
                🚪
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/admin/login')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600
              }}
            >
              <span>🔐</span>
              <span>Admin Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
