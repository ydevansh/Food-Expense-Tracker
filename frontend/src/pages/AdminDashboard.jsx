import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import api from '../api';
import MealCard from '../components/MealCard';
import { fmt, today, mealIcon } from '../utils';

export default function AdminDashboard() {
  const { admin, logoutAdmin, showToast, showModal, closeModal, users } = useApp();
  const navigate = useNavigate();

  // Active section tab: 'dashboard' | 'expenses' | 'payments' | 'settlement' | 'calendar_history' | 'prices' | 'security'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Dashboard & stats data
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Meals data for Manage Expenses & Payments
  const [meals, setMeals] = useState([]);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [paymentUserFilter, setPaymentUserFilter] = useState('');

  // Price settings data
  const [prices, setPrices] = useState({ breakfast: 50, dinner: 70 });
  const [priceHistory, setPriceHistory] = useState([]);
  const [newPrice, setNewPrice] = useState({ meal_type: 'breakfast', price: '', effective_from: today() });
  const [priceSubmitting, setPriceSubmitting] = useState(false);

  // Security credentials state
  const [secForm, setSecForm] = useState({
    currentPassword: '',
    newUsername: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [secLoading, setSecLoading] = useState(false);
  const [secError, setSecError] = useState('');
  const [secSuccess, setSecSuccess] = useState('');

  // Periods for Settlement management
  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [periodActionWorking, setPeriodActionWorking] = useState(false);

  // Initial load
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load admin dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadMeals = useCallback(async () => {
    setMealsLoading(true);
    try {
      const data = await api.getMeals();
      setMeals(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load meals', 'error');
    } finally {
      setMealsLoading(false);
    }
  }, [showToast]);

  const loadPrices = useCallback(async () => {
    try {
      const [cur, hist] = await Promise.all([
        api.getCurrentPrices(),
        api.getSettings()
      ]);
      setPrices(cur);
      setPriceHistory(hist);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadPeriods = useCallback(async () => {
    setPeriodsLoading(true);
    try {
      const data = await api.getPeriods();
      setPeriods(data);
    } catch (err) {
      console.error(err);
    } finally {
      setPeriodsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadMeals();
    loadPrices();
    loadPeriods();
  }, [loadDashboard, loadMeals, loadPrices, loadPeriods]);

  // Handlers for Expense Management
  const handleEditMeal = (meal) => {
    navigate(`/add/${meal._id || meal.id}`);
  };

  const handleDeleteMeal = (meal) => {
    showModal({
      title: '🗑️ Delete Expense Record',
      body: (
        <div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
            Are you sure you want to permanently delete this <strong>{meal.meal_type || meal.mealType}</strong> expense on <strong>{fmt.date(meal.date)}</strong>?
          </p>
          <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
            <div>Total: <strong>{fmt.currency(meal.total_amount || meal.totalAmount)}</strong></div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              Participants: {(meal.participants || []).map(p => p.user_name || p.userName).join(', ')}
            </div>
          </div>
        </div>
      ),
      footer: (
        <>
          <button className="btn btn-secondary flex-1" onClick={closeModal}>Cancel</button>
          <button className="btn btn-danger flex-1" onClick={async () => {
            closeModal();
            try {
              await api.deleteMeal(meal._id || meal.id);
              showToast('Meal record deleted successfully');
              loadMeals();
              loadDashboard();
            } catch (err) {
              showToast(err.response?.data?.error || 'Failed to delete meal', 'error');
            }
          }}>Delete</button>
        </>
      )
    });
  };

  // Handlers for Price Updates
  const handlePriceSubmit = async (e) => {
    e.preventDefault();
    if (!newPrice.price || Number(newPrice.price) <= 0) {
      showToast('Enter a valid price greater than 0', 'error');
      return;
    }
    setPriceSubmitting(true);
    try {
      await api.updatePrice({
        meal_type:      newPrice.meal_type,
        price:          Number(newPrice.price),
        effective_from: newPrice.effective_from || today()
      });
      showToast(`Updated ${newPrice.meal_type} price to ${fmt.currency(newPrice.price)}!`);
      setNewPrice({ meal_type: 'breakfast', price: '', effective_from: today() });
      loadPrices();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update price', 'error');
    } finally {
      setPriceSubmitting(false);
    }
  };

  // Handlers for Security Credentials
  const handleSecuritySubmit = async (e) => {
    e.preventDefault();
    setSecError('');
    setSecSuccess('');

    if (!secForm.currentPassword) {
      setSecError('Please enter your current administrator password.');
      return;
    }
    if (secForm.newPassword && secForm.newPassword.length < 6) {
      setSecError('New password must be at least 6 characters long.');
      return;
    }
    if (secForm.newPassword && secForm.newPassword !== secForm.confirmPassword) {
      setSecError('New password and confirmation do not match.');
      return;
    }
    if (!secForm.newUsername && !secForm.newPassword) {
      setSecError('Provide a new username or new password to update.');
      return;
    }

    setSecLoading(true);
    try {
      const payload = {
        currentPassword: secForm.currentPassword
      };
      if (secForm.newUsername.trim()) payload.newUsername = secForm.newUsername.trim();
      if (secForm.newPassword) payload.newPassword = secForm.newPassword;

      const res = await api.changeCredentials(payload);
      if (res.token) {
        localStorage.setItem('admin_token', res.token);
      }
      setSecSuccess('Credentials updated successfully!');
      showToast('Administrator credentials updated!');
      setSecForm({ currentPassword: '', newUsername: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update credentials.';
      setSecError(msg);
      showToast(msg, 'error');
    } finally {
      setSecLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    showModal({
      title: '🚪 Confirm Logout',
      body: <p style={{ color: 'var(--text-secondary)' }}>Are you sure you want to end your administrative session?</p>,
      footer: (
        <>
          <button className="btn btn-secondary flex-1" onClick={closeModal}>Stay</button>
          <button className="btn btn-primary flex-1" onClick={async () => {
            closeModal();
            await logoutAdmin();
            showToast('Logged out successfully.');
            navigate('/admin/login');
          }}>Logout</button>
        </>
      )
    });
  };

  const navTabs = [
    { id: 'dashboard',        label: 'Dashboard',             icon: '📊' },
    { id: 'expenses',         label: 'Manage Food Expenses',  icon: '🍲' },
    { id: 'payments',         label: 'Manage Payments',       icon: '💳' },
    { id: 'settlement',       label: 'Settlement & Reset',    icon: '💰' },
    { id: 'calendar_history', label: 'Calendar & History',    icon: '📅' },
    { id: 'prices',           label: 'Food Price Settings',   icon: '⚙️' },
    { id: 'security',         label: 'Account & Security',    icon: '🛡️' },
  ];

  return (
    <div className="admin-page-section" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 16px 60px' }}>
      
      {/* ── Top Admin Banner ────────────────────────────────────────────── */}
      <div className="card-elevated" style={{
        padding: '20px 24px',
        marginBottom: 24,
        background: 'linear-gradient(135deg, rgba(30, 30, 45, 0.95) 0%, rgba(45, 45, 68, 0.95) 100%)',
        borderRadius: 16,
        border: '1px solid rgba(99, 102, 241, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
          }}>
            🛡️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
                Admin Control Panel
              </h2>
              <span className="badge" style={{
                background: 'rgba(99, 102, 241, 0.25)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                fontWeight: 700
              }}>
                ADMIN
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Logged in as: <strong style={{ color: 'var(--text-primary)' }}>{admin?.username || 'ydevansh'}</strong>
              {admin?.name && <span> ({admin.name})</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/')}
            title="View website as public visitor"
          >
            🌐 Public View
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/add')}
          >
            ➕ Add Expense
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleLogout}
            title="Logout"
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* ── Section Navigation Tabs (8 sections) ─────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 20,
        borderBottom: '1px solid var(--border)'
      }}>
        {navTabs.map(t => (
          <button
            key={t.id}
            type="button"
            className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              whiteSpace: 'nowrap',
              borderRadius: 20,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 500
            }}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Dashboard Overview ────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div className="card-elevated" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Active Period
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color: 'var(--green)' }}>
                {dashboardData?.active_period?.label || 'No Active Period'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {dashboardData?.active_period ? `${dashboardData.active_period.start_date} → ${dashboardData.active_period.end_date}` : 'Create period in Settlement'}
              </div>
            </div>

            <div className="card-elevated" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Period Expense
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                {fmt.currency(dashboardData?.period_stats?.total_expense || 0)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {dashboardData?.period_stats?.meal_count || 0} meals logged
              </div>
            </div>

            <div className="card-elevated" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Current Prices
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                🌅 Breakfast: {fmt.currency(prices.breakfast)}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                🌙 Dinner: {fmt.currency(prices.dinner)}
              </div>
            </div>
          </div>

          {/* Roommate Running Balances */}
          <div className="card-elevated" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
              👥 Active Roommate Balances
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {(dashboardData?.user_balances || []).map(b => (
                <div key={b.user._id || b.user.id} style={{
                  background: 'var(--bg-input)',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{b.user.name}</span>
                    <span style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: b.balance >= 0 ? 'var(--green)' : 'var(--red)'
                    }}>
                      {b.balance >= 0 ? '+' : ''}{fmt.currency(b.balance)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    <span>Paid: {fmt.currency(b.total_paid)}</span>
                    <span>Share: {fmt.currency(b.total_share)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="card-elevated" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
              ⚡ Administrator Shortcuts
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/add')}>
                ➕ Add New Meal Expense
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('expenses')}>
                🍲 Manage Food Records
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settlement')}>
                💰 Settlement & Reset Periods
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('prices')}>
                ⚙️ Update Meal Prices
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('security')}>
                🛡️ Change Admin Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Manage Food Expenses ─────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Manage Food Expenses</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Edit or delete existing breakfast and dinner records, or add corrections.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/add')}>
              ➕ Add New Expense
            </button>
          </div>

          {mealsLoading ? (
            <div className="page-loader"><div className="loader-spinner" /></div>
          ) : meals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🍽️</div>
              <h3>No expenses found</h3>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {meals.map(m => (
                <MealCard
                  key={m._id || m.id}
                  meal={m}
                  users={users}
                  showDate={true}
                  onEdit={handleEditMeal}
                  onDelete={handleDeleteMeal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Manage Payments ───────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="card-elevated" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Manage Meal Payments</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Filter and audit who paid for food expenses.
              </p>
            </div>
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: 160 }}
              value={paymentUserFilter}
              onChange={e => setPaymentUserFilter(e.target.value)}
            >
              <option value="">All Roommates</option>
              {users.map(u => (
                <option key={u._id || u.id} value={u._id || u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meals
              .filter(m => (m.payments || []).length > 0)
              .filter(m => !paymentUserFilter || (m.payments || []).some(p => (p.user_id || p.userId)?.toString() === paymentUserFilter))
              .map(m => (
                <div key={m._id || m.id} style={{
                  background: 'var(--bg-input)',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{fmt.date(m.date)}</span>
                    <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>{mealIcon(m.meal_type || m.mealType)} {m.meal_type || m.mealType}</span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Total Meal Cost: <strong>{fmt.currency(m.total_amount || m.totalAmount)}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {(m.payments || []).map(p => (
                      <div key={p.user_id || p.userId} style={{ fontSize: 13, fontWeight: 600 }}>
                        {p.user_name || p.userName}: <span style={{ color: 'var(--green)' }}>{fmt.currency(p.amount_paid || p.amountPaid)}</span>
                      </div>
                    ))}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '2px 8px', marginTop: 4 }}
                      onClick={() => handleEditMeal(m)}
                    >
                      ✏️ Edit Payment
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Tab 4: Settlement & Balance Reset ────────────────────────────── */}
      {activeTab === 'settlement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-elevated" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Settlement & Accounting Periods</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                  Calculate settlement, confirm payments, reset running balances, or reopen wrong settlements.
                </p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/settlement')}>
                🚀 Open Full Settlement Page
              </button>
            </div>
          </div>

          {/* List existing periods */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {periods.map(p => (
              <div key={p._id || p.id} className="card-elevated" style={{
                padding: 18,
                borderLeft: p.status === 'active' ? '4px solid var(--green)' : p.status === 'pending' ? '4px solid var(--yellow)' : '4px solid #867DEA'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {fmt.date(p.start_date)} → {fmt.date(p.end_date)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`status-badge ${p.status}`}>
                      {p.status === 'active' ? '● Active' : p.status === 'pending' ? '⏳ Pending' : '✓ Settled'}
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate('/settlement')}
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab 5: Calendar & History ────────────────────────────────────── */}
      {activeTab === 'calendar_history' && (
        <div className="card-elevated" style={{ padding: 22 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Calendar & Record History</h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
            Jump to any date in the calendar or full record history to audit and update meals.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/calendar')}>
              📅 Open Interactive Calendar
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/history')}>
              📜 Open Full Expense History
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/reports')}>
              📈 Open Financial Reports
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 6: Food Price Settings ───────────────────────────────────── */}
      {activeTab === 'prices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Current Prices Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div className="card-elevated" style={{ padding: 20, borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Breakfast Price</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', marginTop: 6 }}>
                {fmt.currency(prices.breakfast)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/ plate</span>
              </div>
            </div>

            <div className="card-elevated" style={{ padding: 20, borderLeft: '4px solid #6366f1' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Dinner Price</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#6366f1', marginTop: 6 }}>
                {fmt.currency(prices.dinner)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/ plate</span>
              </div>
            </div>
          </div>

          {/* Update Price Form */}
          <div className="card-elevated" style={{ padding: 22 }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              Update Meal Price
            </h4>
            <form onSubmit={handlePriceSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Meal Type</label>
                <select
                  className="form-input"
                  value={newPrice.meal_type}
                  onChange={e => setNewPrice({ ...newPrice, meal_type: e.target.value })}
                >
                  <option value="breakfast">🌅 Breakfast</option>
                  <option value="dinner">🌙 Dinner</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">New Price (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 55"
                  min="1"
                  step="0.5"
                  value={newPrice.price}
                  onChange={e => setNewPrice({ ...newPrice, price: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Effective From</label>
                <input
                  type="date"
                  className="form-input"
                  value={newPrice.effective_from}
                  onChange={e => setNewPrice({ ...newPrice, effective_from: e.target.value })}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={priceSubmitting}
                style={{ height: 42 }}
              >
                {priceSubmitting ? 'Saving...' : '💾 Save Price'}
              </button>
            </form>
          </div>

          {/* Price History Table */}
          <div className="card-elevated" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>
              Price Change History
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {priceHistory.map(h => (
                <div key={h._id || h.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-input)',
                  borderRadius: 8,
                  fontSize: 13
                }}>
                  <span>
                    <strong>{h.mealType === 'breakfast' ? '🌅 Breakfast' : '🌙 Dinner'}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>Effective: {fmt.date(h.effectiveFrom)}</span>
                  </span>
                  <span style={{ fontWeight: 700 }}>{fmt.currency(h.price)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 7: Account & Security ────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="card-elevated" style={{ maxWidth: 520, margin: '0 auto', padding: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
              Administrator Account & Security
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Change your admin username or password. Requires your current password.
            </p>
          </div>

          {secError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#ef4444',
              marginBottom: 16
            }}>
              ⚠️ {secError}
            </div>
          )}

          {secSuccess && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--green)',
              marginBottom: 16
            }}>
              ✅ {secSuccess}
            </div>
          )}

          <form onSubmit={handleSecuritySubmit}>
            <div className="form-group">
              <label className="form-label">Current Password *</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter current password"
                value={secForm.currentPassword}
                onChange={e => setSecForm({ ...secForm, currentPassword: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Username (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder={`Current: ${admin?.username || 'ydevansh'}`}
                value={secForm.newUsername}
                onChange={e => setSecForm({ ...secForm, newUsername: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password (Optional, min 6 characters)</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter new strong password"
                value={secForm.newPassword}
                onChange={e => setSecForm({ ...secForm, newPassword: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Confirm new password"
                value={secForm.confirmPassword}
                onChange={e => setSecForm({ ...secForm, confirmPassword: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={secLoading}
              style={{ marginTop: 16 }}
            >
              {secLoading ? 'Updating...' : '🔒 Update Administrator Credentials'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
