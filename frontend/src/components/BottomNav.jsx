import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../App';

export default function BottomNav() {
  const { isAdmin } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const path     = location.pathname;

  const isActive = (p) => path === p || (p !== '/' && path.startsWith(p));

  if (isAdmin) {
    return (
      <nav className="bottom-nav">
        <button
          className={`nav-item ${isActive('/') && path === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span>Home</span>
        </button>

        <button
          className={`nav-item ${isActive('/calendar') ? 'active' : ''}`}
          onClick={() => navigate('/calendar')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>Calendar</span>
        </button>

        <button
          className={`nav-item nav-add-btn ${isActive('/add') ? 'active' : ''}`}
          onClick={() => navigate('/add')}
        >
          <div className="add-fab">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <span>Add</span>
        </button>

        <button
          className={`nav-item ${isActive('/history') ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span>History</span>
        </button>

        <button
          className={`nav-item ${isActive('/admin') ? 'active' : ''}`}
          onClick={() => navigate('/admin')}
        >
          <span style={{ fontSize: 20 }}>🛡️</span>
          <span>Admin</span>
        </button>
      </nav>
    );
  }

  // Public visitor bottom nav
  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${isActive('/') && path === '/' ? 'active' : ''}`}
        onClick={() => navigate('/')}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span>Home</span>
      </button>

      <button
        className={`nav-item ${isActive('/calendar') ? 'active' : ''}`}
        onClick={() => navigate('/calendar')}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>Calendar</span>
      </button>

      <button
        className={`nav-item ${isActive('/history') ? 'active' : ''}`}
        onClick={() => navigate('/history')}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        <span>History</span>
      </button>

      <button
        className={`nav-item ${isActive('/reports') ? 'active' : ''}`}
        onClick={() => navigate('/reports')}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <span>Reports</span>
      </button>

      <button
        className={`nav-item ${isActive('/admin/login') ? 'active' : ''}`}
        onClick={() => navigate('/admin/login')}
      >
        <span style={{ fontSize: 18 }}>🔐</span>
        <span>Login</span>
      </button>
    </nav>
  );
}
