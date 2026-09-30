import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Header     from './components/Header';
import BottomNav  from './components/BottomNav';
import Toast      from './components/Toast';
import Modal      from './components/Modal';
import Dashboard  from './pages/Dashboard';
import CalendarPage from './pages/Calendar';
import AddExpense from './pages/AddExpense';
import History    from './pages/History';
import Settlement from './pages/Settlement';
import Reports    from './pages/Reports';
import Settings   from './pages/Settings';
import api        from './api';

// ─── Global Context ───────────────────────────────────────────────────────────
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// Page title map
const PAGE_TITLES = {
  '/':           'Dashboard',
  '/calendar':   'Calendar',
  '/add':        'Add Expense',
  '/history':    'History',
  '/settlement': 'Settlement',
  '/reports':    'Reports',
  '/settings':   'Settings',
};

export default function App() {
  const [users,  setUsers]  = useState([]);
  const [toast,  setToast]  = useState(null);
  const [modal,  setModal]  = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

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

  // Determine page title
  const editMatch  = location.pathname.match(/^\/add\/(.+)/);
  const pageTitle  = editMatch ? 'Edit Expense' : (PAGE_TITLES[location.pathname] || 'Food Tracker');

  return (
    <AppContext.Provider value={{ users, showToast, showModal, closeModal, navigate }}>
      <div id="app">
        <Header title={pageTitle} />

        <main className="main-content">
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/calendar"      element={<CalendarPage />} />
            <Route path="/add"           element={<AddExpense />} />
            <Route path="/add/:id"       element={<AddExpense />} />
            <Route path="/history"       element={<History />} />
            <Route path="/settlement"    element={<Settlement />} />
            <Route path="/reports"       element={<Reports />} />
            <Route path="/settings"      element={<Settings />} />
          </Routes>
        </main>

        <BottomNav />

        {toast && <Toast msg={toast.msg} type={toast.type} />}
        {modal && <Modal {...modal} onClose={closeModal} />}
      </div>
    </AppContext.Provider>
  );
}
