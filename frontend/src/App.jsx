import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import Header        from './components/Header';
import BottomNav     from './components/BottomNav';
import Toast         from './components/Toast';
import Modal         from './components/Modal';
import Dashboard     from './pages/Dashboard';
import CalendarPage  from './pages/Calendar';
import AddExpense    from './pages/AddExpense';
import History       from './pages/History';
import Settlement    from './pages/Settlement';
import Reports       from './pages/Reports';
import Settings      from './pages/Settings';
import AdminLogin    from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import api           from './api';

// ─── Global Context ───────────────────────────────────────────────────────────
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// Page title map
const PAGE_TITLES = {
  '/':            'Dashboard',
  '/calendar':    'Calendar',
  '/add':         'Add Expense',
  '/history':     'History',
  '/settlement':  'Settlement',
  '/reports':     'Reports',
  '/settings':    'Settings',
  '/admin':       'Admin Panel',
  '/admin/login': 'Admin Login',
};

// ─── Protected Route Component ────────────────────────────────────────────────
function RequireAdmin({ children }) {
  const { admin, authLoading } = useApp();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="page-loader" style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader-spinner" />
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function App() {
  const [users,       setUsers]       = useState([]);
  const [admin,       setAdmin]       = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [toast,       setToast]       = useState(null);
  const [modal,       setModal]       = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Check auth status on mount
  useEffect(() => {
    api.getMe()
      .then(res => {
        if (res.authenticated && res.admin) {
          setAdmin(res.admin);
        }
      })
      .catch(() => {
        // Not authenticated
        localStorage.removeItem('admin_token');
        setAdmin(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  // Load users once on mount
  useEffect(() => {
    api.getUsers().then(setUsers).catch(err => console.error('Failed to load users:', err));
  }, []);

  // Toast helper
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Modal helpers
  const showModal  = useCallback((props) => setModal(props), []);
  const closeModal = useCallback(() => setModal(null), []);

  // Login & Logout helpers
  const loginAdmin = useCallback((adminData) => {
    setAdmin(adminData);
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore network error on logout
    } finally {
      localStorage.removeItem('admin_token');
      setAdmin(null);
    }
  }, []);

  // Determine page title
  const editMatch  = location.pathname.match(/^\/add\/(.+)/);
  const pageTitle  = editMatch ? 'Edit Expense' : (PAGE_TITLES[location.pathname] || 'Food Tracker');

  return (
    <AppContext.Provider value={{
      users,
      admin,
      isAdmin: !!admin,
      authLoading,
      loginAdmin,
      logoutAdmin,
      showToast,
      showModal,
      closeModal,
      navigate
    }}>
      <div id="app">
        <Header title={pageTitle} />

        <main className="main-content">
          <Routes>
            {/* Public read-only routes */}
            <Route path="/"              element={<Dashboard />} />
            <Route path="/calendar"      element={<CalendarPage />} />
            <Route path="/history"       element={<History />} />
            <Route path="/settlement"    element={<Settlement />} />
            <Route path="/reports"       element={<Reports />} />
            <Route path="/settings"      element={<Settings />} />

            {/* Admin auth routes */}
            <Route path="/admin/login"   element={<AdminLogin />} />
            <Route path="/admin"         element={
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            } />

            {/* Protected expense editing routes */}
            <Route path="/add"           element={
              <RequireAdmin>
                <AddExpense />
              </RequireAdmin>
            } />
            <Route path="/add/:id"       element={
              <RequireAdmin>
                <AddExpense />
              </RequireAdmin>
            } />
          </Routes>
        </main>

        <BottomNav />

        {toast && <Toast msg={toast.msg} type={toast.type} />}
        {modal && <Modal {...modal} onClose={closeModal} />}
      </div>
    </AppContext.Provider>
  );
}
