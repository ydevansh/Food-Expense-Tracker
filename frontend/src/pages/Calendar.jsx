import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import api from '../api';
import MealCard from '../components/MealCard';
import { fmt, today, daysInMonth, firstDayOfMonth } from '../utils';

export default function CalendarPage() {
  const { users, showModal, closeModal, isAdmin, showToast } = useApp();
  const navigate = useNavigate();
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calData, setCalData] = useState({});
  const [loading, setLoading] = useState(true);

  const todayStr = today();

  const loadMonth = async (y, m) => {
    setLoading(true);
    try {
      const d = await api.getCalendar(y, m);
      setCalData(d);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadMonth(year, month); }, [year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const handleEditMeal = (meal) => {
    closeModal();
    navigate(`/add/${meal._id || meal.id}`);
  };

  const handleDeleteMeal = async (meal) => {
    try {
      await api.deleteMeal(meal._id || meal.id);
      showToast('Meal deleted!');
      closeModal();
      loadMonth(year, month);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const openDay = async (dateStr) => {
    try {
      const data = await api.getDaily(dateStr);
      showModal({
        title: fmt.date(dateStr),
        body: (
          <DayDetail
            data={data}
            users={users}
            isAdmin={isAdmin}
            onEdit={handleEditMeal}
            onDelete={handleDeleteMeal}
          />
        ),
        footer: (
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button className="btn btn-secondary flex-1" onClick={closeModal}>Close</button>
            {isAdmin && (
              <button
                className="btn btn-primary flex-1"
                onClick={() => {
                  closeModal();
                  navigate('/add');
                }}
              >
                + Add Meal
              </button>
            )}
          </div>
        )
      });
    } catch (err) { console.error(err); }
  };

  const days     = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month); // 0=Sun

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  return (
    <div className="calendar-container">
      {/* Navigation */}
      <div className="calendar-nav">
        <button className="calendar-nav-btn" onClick={prevMonth}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="calendar-month-title">
          {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <button className="calendar-nav-btn" onClick={nextMonth}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {loading ? (
        <div className="page-loader"><div className="loader-spinner" /></div>
      ) : (
        <>
          {/* Day-of-week header */}
          <div className="calendar-grid">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))}

            {/* Days */}
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="calendar-day empty" />;
              const mm  = String(month).padStart(2, '0');
              const dd  = String(day).padStart(2, '0');
              const ds  = `${year}-${mm}-${dd}`;
              const has = calData[ds];
              const isToday = ds === todayStr;

              return (
                <div
                  key={ds}
                  className={`calendar-day ${has ? 'has-meals' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => openDay(ds)}
                >
                  <span className="day-number">{day}</span>
                  {has && (
                    <div className="day-dots">
                      {has.has_breakfast && <span className="day-dot breakfast" title="Breakfast" />}
                      {has.has_dinner    && <span className="day-dot dinner"    title="Dinner" />}
                    </div>
                  )}
                  {has && has.total_amount > 0 && (
                    <span className="day-amount">{fmt.currency(has.total_amount)}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="calendar-legend">
            <span className="legend-item"><span className="legend-dot breakfast" /> Breakfast</span>
            <span className="legend-item"><span className="legend-dot dinner" /> Dinner</span>
            <span className="legend-item"><span className="legend-dot today-dot" /> Today</span>
          </div>
        </>
      )}
    </div>
  );
}

// Day detail modal body
function DayDetail({ data, users, isAdmin, onEdit, onDelete }) {
  const { meals, day_total, user_summary } = data;
  return (
    <div className="day-detail">
      {meals.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No meals recorded</p>
      ) : (
        meals.map(meal => (
          <MealCard
            key={meal._id || meal.id}
            meal={meal}
            users={users}
            showDate={false}
            onEdit={isAdmin ? () => onEdit(meal) : undefined}
            onDelete={isAdmin ? () => onDelete(meal) : undefined}
          />
        ))
      )}

      {meals.length > 0 && (
        <>
          <div className="divider" />
          <div className="card-elevated">
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Day Summary</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--orange)' }}>{fmt.currency(day_total)}</span>
            </div>
            {(user_summary || []).map(us => (
              <div key={us.user._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{us.user.name} — Share: {fmt.currency(us.total_share)}</span>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>Paid: {fmt.currency(us.total_paid)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
