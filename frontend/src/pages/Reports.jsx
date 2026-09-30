import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import api from '../api';
import { fmt, today, balanceClass } from '../utils';

export default function Reports() {
  const { showToast } = useApp();
  const now = new Date();
  const [startDate, setStartDate] = useState(now.toISOString().substring(0, 7) + '-01');
  const [endDate,   setEndDate]   = useState(today());
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.getReports({ start_date: startDate, end_date: endDate });
      setData(d);
    } catch { showToast('Failed to load reports', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const setPreset = (start, end) => { setStartDate(start); setEndDate(end); };

  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <div className="page-section">
      {/* Date Range Picker */}
      <div className="card-elevated">
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📅 Report Period</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div className="form-group">
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={endDate} max={today()} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPreset(`${y}-${m}-01`, `${y}-${m}-15`)}>1–15</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPreset(`${y}-${m}-16`, `${y}-${m}-${lastDay}`)}>16–End</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPreset(`${y}-${m}-01`, `${y}-${m}-${lastDay}`)}>Full Month</button>
        </div>
        <button className="btn btn-primary btn-full" onClick={load} disabled={loading}>
          {loading ? 'Loading...' : '📊 Generate Report'}
        </button>
      </div>

      {loading && <div className="page-loader"><div className="loader-spinner" /></div>}

      {data && !loading && (
        <>
          {/* Overall Stats */}
          <div className="card-gradient">
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
              {fmt.date(startDate)} → {fmt.date(endDate)}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>
              {fmt.currency(data.stats.total_expense)}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
              Total Food Expense
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">🌅 Breakfast</div>
              <div className="stat-value orange">{fmt.currencyShort(data.stats.breakfast_expense)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">🌙 Dinner</div>
              <div className="stat-value orange">{fmt.currencyShort(data.stats.dinner_expense)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">🍽️ Total Plates</div>
              <div className="stat-value">{data.stats.total_plates}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">📅 Days</div>
              <div className="stat-value">{data.stats.days_with_meals}</div>
            </div>
          </div>

          {/* Per-User Stats */}
          <div>
            <div className="section-title">Per Person Summary</div>
            <div className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data.user_stats || []).map((us, i) => (
                <div key={us.user._id} className="report-user-card">
                  <div className="report-user-header">
                    <div className={`avatar avatar-${i % 3}`}>{(us.user.name || '?').charAt(0)}</div>
                    <div className="report-user-name">{us.user.name}</div>
                  </div>
                  <div className="report-row">
                    <span className="label">Food Share</span>
                    <span className="value">{fmt.currency(us.total_share)}</span>
                  </div>
                  <div className="report-row">
                    <span className="label">Amount Paid</span>
                    <span className="value" style={{ color: 'var(--green)' }}>{fmt.currency(us.total_paid)}</span>
                  </div>
                  <div className="report-balance">
                    <span style={{ color: 'var(--text-secondary)' }}>Balance</span>
                    <span style={{ color: us.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {us.balance >= 0 ? '+' : ''}{fmt.currency(us.balance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="info-box">
            <strong>Note:</strong> Settlement does not delete food records. Historical data is always preserved.
          </div>
        </>
      )}
    </div>
  );
}
