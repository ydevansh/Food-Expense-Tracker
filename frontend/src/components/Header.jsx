import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/',           label: 'Dashboard',  icon: '📊' },
  { path: '/calendar',   label: 'Calendar',   icon: '📅' },
  { path: '/add',        label: 'Add Expense',icon: '➕' },
  { path: '/history',    label: 'History',    icon: '📜' },
  { path: '/settlement', label: 'Settlement', icon: '💰' },
  { path: '/reports',    label: 'Reports',    icon: '📈' },
  { path: '/settings',   label: 'Settings',   icon: '⚙️' },
];

export default function Header({ title }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const path      = location.pathname;
  const showBack  = path !== '/';

  const isActive = (p) => path === p || (p !== '/' && path.startsWith(p));

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Left: Logo & Back */}
        <div className="header-brand" onClick={() => navigate('/')}>
          <span className="header-logo">🍽️</span>
          <span className="brand-text">
            <span className="brand-title">Food Expense Tracker</span>
            <span className="brand-badge">3 Roommates</span>
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
          {NAV_ITEMS.map((item) => {
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
          <button
            className="btn btn-primary btn-sm desktop-add-btn"
            onClick={() => navigate('/add')}
          >
            + Add Expense
          </button>

          {path === '/' && (
            <>
              <button className="btn btn-ghost btn-sm mobile-action-btn" onClick={() => navigate('/settings')} title="Settings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
              <button className="btn btn-ghost btn-sm mobile-action-btn" onClick={() => navigate('/reports')} title="Reports">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
