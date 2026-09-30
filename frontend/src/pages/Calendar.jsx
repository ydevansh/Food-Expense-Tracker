import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import api from '../api';
import MealCard from '../components/MealCard';
import { fmt, today, daysInMonth, firstDayOfMonth } from '../utils';

export default function CalendarPage() {
  const { users, showModal, closeModal } = useApp();
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

  const openDay = async (dateStr) => {
    try {
      const data = await api.getDaily(dateStr);
      showModal({
        title: fmt.date(dateStr),
        body: <DayDetail data={data} users={users} />,
        footer: <button className="btn btn-secondary btn-full" onClick={closeModal}>Close</button>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="calendar-month">{fmt.monthYear(year, month)}</div>
        <button className="calendar-nav-btn" onClick={nextMonth}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="calendar-weekdays">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="weekday">{d}</div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="page-loader" style={{ padding: 40 }}>
          <div className="loader-spinner" />
        </div>
      ) : (
        <div className="calendar-grid">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="cal-day empty" />;
            const mm  = String(month).padStart(2, '0');
            const dd  = String(day).padStart(2, '0');
            const str = `${year}-${mm}-${dd}`;
            const info = calData[str];
            const isToday = str === todayStr;

            return (
              <div
                key={str}
                className={`cal-day ${isToday ? 'today' : ''} ${info ? 'has-data' : ''}`}
                onClick={() => info && openDay(str)}
                style={{ cursor: info ? 'pointer' : 'default' }}
              >
                <span className="cal-day-num">{day}</span>
                {info && (
                  <div className="cal-dots">
                    {info.breakfast && <span className="cal-dot breakfast" title="Breakfast" />}
                    {info.dinner    && <span className="cal-dot dinner"    title="Dinner"    />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, padding: '16px 0', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span className="cal-dot breakfast" /> Breakfast
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span className="cal-dot dinner" /> Dinner
        </div>
      </div>
    </div>
  );
}

// Day detail modal body
function DayDetail({ data, users }) {
  const { meals, day_total, user_summary } = data;
  return (
    <div className="day-detail">
      {meals.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No meals recorded</p>
      ) : (
        meals.map(meal => (
          <MealCard key={meal._id || meal.id} meal={meal} users={users} showDate={false} />
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
