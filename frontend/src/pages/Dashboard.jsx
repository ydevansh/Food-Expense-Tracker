import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import api from '../api';
import MealCard from '../components/MealCard';
import { fmt, balanceClass, today } from '../utils';

export default function Dashboard() {
  const { users, showToast, showModal, closeModal, isAdmin } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const d = await api.getDashboard();
      setData(d);
    } catch (err) {
      showToast('Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (meal) => navigate(`/add/${meal._id || meal.id}`);

  const handleDelete = (meal) => {
    showModal({
      title: 'Delete Meal',
      body: (
        <div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            Are you sure you want to delete this {meal.meal_type} record from {fmt.date(meal.date)}?
          </p>
          <p style={{ color: 'var(--red)', fontSize: 13 }}>This action cannot be undone.</p>
        </div>
      ),
      footer: (
        <>
          <button className="btn btn-secondary flex-1" onClick={closeModal}>Cancel</button>
          <button className="btn btn-danger flex-1" onClick={async () => {
            try {
              await api.deleteMeal(meal._id || meal.id);
              showToast('Meal deleted successfully');
              closeModal();
              load();
            } catch (err) {
              const msg = err?.response?.data?.error || 'Failed to delete meal';
              showToast(msg, 'error');
            }
          }}>Delete</button>
        </>
      )
    });
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!data) return null;

  const {
    period_stats: ps,
    user_balances: ub,
    today: todayMeals,
    today_date,
    active_period: activePeriod
  } = data;

  const hasActivePeriod = !!activePeriod;

  return (
    <div className="page-section">
      {/* ── Period Banner ─────────────────────────────────────────────── */}
      {hasActivePeriod ? (
        <div className="card-gradient" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>
            🟢 Current Period
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>
            {activePeriod.label}
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>
            {fmt.currency(ps.total_expense)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8 }}>
            {ps.days_with_meals} days · {ps.meal_count} meals · {ps.total_plates} plates this period
          </div>
        </div>
      ) : (
        <div className="card-elevated" style={{ borderLeft: '3px solid var(--yellow)', marginBottom: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--yellow)', marginBottom: 6 }}>
            ⚠️ No Active Period
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 10 }}>
            All balances show <strong>₹0.00</strong> because no accounting period is active.
            New meals can still be recorded but won't affect balances until a period is started.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/settlement')}>
            ➕ Start New Period
          </button>
        </div>
      )}

      {/* ── Stat Grid ────────────────────────────────────────────────── */}
      {hasActivePeriod && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">🌅 Breakfast</div>
            <div className="stat-value orange">{fmt.currencyShort(ps.breakfast_expense)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>This period</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">🌙 Dinner</div>
            <div className="stat-value orange">{fmt.currencyShort(ps.dinner_expense)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>This period</div>
          </div>
        </div>
      )}

      {/* ── Balances ─────────────────────────────────────────────────── */}
      <div>
        <div className="section-title">
          {hasActivePeriod ? '📊 Period Balances' : '📊 Balances (No Active Period)'}
        </div>
        <div className="mt-8" />
        <div className="balance-grid">
          {(ub || []).map((b, i) => (
            <div key={b.user._id} className="balance-card">
              <div className="balance-header">
                <div className={`avatar avatar-${i}`}>{b.user.name.charAt(0)}</div>
                <div className="balance-name">{b.user.name}</div>
              </div>
              <div className={`balance-amount ${balanceClass(b.balance)}`}>
                {b.balance >= 0 ? '+' : ''}{fmt.currency(b.balance)}
              </div>
              <div className="balance-label">
                {b.balance > 0.005 ? 'to receive' : b.balance < -0.005 ? 'to pay' : 'balanced'}
              </div>
              {hasActivePeriod && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Paid {fmt.currency(b.total_paid)} / Share {fmt.currency(b.total_share)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="info-box mt-8">
          <strong style={{ color: 'var(--green)' }}>+</strong> = paid more → receive at settlement&nbsp;&nbsp;•&nbsp;&nbsp;
          <strong style={{ color: 'var(--red)' }}>−</strong> = paid less → pay at settlement
          {hasActivePeriod && (
            <span style={{ marginLeft: 8, opacity: 0.7 }}>• Only <strong>{activePeriod.label}</strong> included</span>
          )}
        </div>
      </div>

      {/* ── Lower Grid ───────────────────────────────────────────────── */}
      <div className="dashboard-lower-grid">
        {/* Today's Meals */}
        <div>
          <div className="section-title">Today's Meals</div>
          <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todayMeals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🍽️</div>
                <h3>No meals recorded today</h3>
                <p>Today's breakfast or dinner will appear here once recorded</p>
                {isAdmin && (
                  <button className="btn btn-primary mt-8" onClick={() => navigate('/add')}>
                    + Add Meal
                  </button>
                )}
              </div>
            ) : (
              todayMeals.map(meal => (
                <MealCard
                  key={meal._id || meal.id}
                  meal={meal}
                  users={users}
                  onEdit={isAdmin ? handleEdit : undefined}
                  onDelete={isAdmin ? handleDelete : undefined}
                />
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="section-title">Quick Actions</div>
          <div className="mt-8 dashboard-quick-actions">
            {isAdmin ? (
              <button className="btn btn-primary btn-full" onClick={() => navigate('/add')}>
                ➕ Add New Meal
              </button>
            ) : (
              <button className="btn btn-secondary btn-full" onClick={() => navigate('/admin/login')} style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#a5b4fc', fontWeight: 600 }}>
                🔐 Administrator Login
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => navigate('/settlement')}>
                💰 {isAdmin ? (hasActivePeriod ? 'Settle Up' : 'Periods') : 'Settlements'}
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/reports')}>
                📊 Reports
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/calendar')}>
                📅 Calendar
              </button>
              <button className="btn btn-secondary" onClick={() => navigate(isAdmin ? '/admin' : '/history')}>
                {isAdmin ? '🛡️ Admin Panel' : '📜 History'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
