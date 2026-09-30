import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import api from '../api';
import MealCard from '../components/MealCard';
import { fmt, balanceClass, today } from '../utils';

export default function Dashboard() {
  const { users, showToast, showModal, closeModal } = useApp();
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
            } catch {
              showToast('Failed to delete meal', 'error');
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

  const { month_stats: ms, user_balances: ub, today: todayMeals, today_date } = data;

  return (
    <div className="page-section">
      {/* Hero Card */}
      <div className="card-gradient">
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          This Month
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>
          {fmt.date(today_date)}
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>
          {fmt.currency(ms.total_expense)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
          {ms.days_with_meals} days • {ms.meal_count} meals • {ms.total_plates} plates
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">🌅 Breakfast</div>
          <div className="stat-value orange">{fmt.currencyShort(ms.breakfast_expense)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🌙 Dinner</div>
          <div className="stat-value orange">{fmt.currencyShort(ms.dinner_expense)}</div>
        </div>
      </div>

      {/* Balances */}
      <div>
        <div className="section-title">Monthly Balances (Running)</div>
        <div className="mt-8" />
        <div className="balance-grid">
          {(ub || []).map((b, i) => (
            <div key={b.user._id} className="balance-card">
              <div className="balance-name">{b.user.name}</div>
              <div className={`balance-amount ${balanceClass(b.balance)}`}>
                {b.balance >= 0 ? '+' : ''}{fmt.currency(b.balance)}
              </div>
              <div className="balance-label">
                {b.balance > 0.005 ? 'to receive' : b.balance < -0.005 ? 'to pay' : 'balanced'}
              </div>
            </div>
          ))}
        </div>
        <div className="info-box mt-8">
          <strong style={{ color: 'var(--green)' }}>+</strong> = paid more → receive at settlement&nbsp;&nbsp;
          <strong style={{ color: 'var(--red)' }}>−</strong> = paid less → pay at settlement
        </div>
      </div>

      {/* Today's Meals */}
      <div>
        <div className="section-title">Today's Meals</div>
        <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {todayMeals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🍽️</div>
              <h3>No meals recorded today</h3>
              <p>Tap the <strong>+</strong> button to add today's breakfast or dinner</p>
              <button className="btn btn-primary mt-8" onClick={() => navigate('/add')}>
                + Add Meal
              </button>
            </div>
          ) : (
            todayMeals.map(meal => (
              <MealCard
                key={meal._id || meal.id}
                meal={meal}
                users={users}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/reports')}>
          📊 Reports
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/settlement')}>
          💰 Settle Up
        </button>
      </div>
    </div>
  );
}
