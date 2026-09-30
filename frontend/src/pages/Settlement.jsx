import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import api from '../api';
import { fmt, today, balanceClass } from '../utils';

export default function Settlement() {
  const { showToast, showModal, closeModal } = useApp();
  const [settlements, setSettlements] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [creating,    setCreating]    = useState(false);

  // New settlement form
  const now = new Date();
  const [startDate, setStartDate] = useState(now.toISOString().substring(0, 7) + '-01');
  const [endDate,   setEndDate]   = useState(today());

  const load = async () => {
    setLoading(true);
    try { setSettlements(await api.getSettlements()); }
    catch (err) { showToast('Failed to load settlements', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createSettlement = async () => {
    if (!startDate || !endDate) { showToast('Pick a date range', 'error'); return; }
    if (startDate > endDate)    { showToast('Start date must be before end date', 'error'); return; }
    setCreating(true);
    try {
      await api.createSettlement({ start_date: startDate, end_date: endDate });
      showToast('Settlement created!');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    } finally { setCreating(false); }
  };

  const markPaid = async (settlement, tx) => {
    const newStatus = tx.status === 'paid' ? 'pending' : 'paid';
    try {
      const updated = await api.updateTransaction(settlement._id || settlement.id, tx._id || tx.id, newStatus);
      setSettlements(prev => prev.map(s => (s._id === updated._id || s.id === updated.id) ? updated : s));
      showToast(newStatus === 'paid' ? 'Marked as paid! ✅' : 'Marked as pending');
    } catch { showToast('Update failed', 'error'); }
  };

  const deleteSettlement = async (s) => {
    showModal({
      title: 'Delete Settlement',
      body: <p style={{ color: 'var(--text-secondary)' }}>Delete this settlement record? Food records remain intact.</p>,
      footer: (
        <>
          <button className="btn btn-secondary flex-1" onClick={closeModal}>Cancel</button>
          <button className="btn btn-danger flex-1" onClick={async () => {
            try {
              await api.deleteSettlement(s._id || s.id);
              showToast('Deleted!');
              closeModal();
              load();
            } catch { showToast('Delete failed', 'error'); }
          }}>Delete</button>
        </>
      )
    });
  };

  return (
    <div className="page-section">
      {/* Create New Settlement */}
      <div className="card-elevated">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🆕 Create Settlement Period</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={endDate} max={today()} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const d = new Date(); const y = d.getFullYear(), m = d.getMonth() + 1;
            const mid = y + '-' + String(m).padStart(2,'0') + '-15';
            setStartDate(y + '-' + String(m).padStart(2,'0') + '-01');
            setEndDate(mid);
          }}>1–15</button>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const d = new Date(); const y = d.getFullYear(), m = d.getMonth() + 1;
            const last = new Date(y, m, 0).getDate();
            setStartDate(y + '-' + String(m).padStart(2,'0') + '-16');
            setEndDate(y + '-' + String(m).padStart(2,'0') + '-' + last);
          }}>16–End</button>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const d = new Date(); const y = d.getFullYear(), m = d.getMonth() + 1;
            const last = new Date(y, m, 0).getDate();
            setStartDate(y + '-' + String(m).padStart(2,'0') + '-01');
            setEndDate(y + '-' + String(m).padStart(2,'0') + '-' + last);
          }}>Full Month</button>
        </div>
        <button className="btn btn-primary btn-full mt-12" onClick={createSettlement} disabled={creating}>
          {creating ? 'Calculating...' : '📊 Calculate & Create Settlement'}
        </button>
      </div>

      {/* Existing Settlements */}
      {loading ? (
        <div className="page-loader"><div className="loader-spinner" /></div>
      ) : settlements.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h3>No settlements yet</h3>
          <p>Create one above after 15 days or at month end</p>
        </div>
      ) : (
        <div className="settlement-grid">
          {settlements.map(s => (
            <SettlementCard key={s._id || s.id} settlement={s} onMarkPaid={markPaid} onDelete={deleteSettlement} />
          ))}
        </div>
      )}
    </div>
  );
}

function SettlementCard({ settlement: s, onMarkPaid, onDelete }) {
  const [open, setOpen] = useState(false);

  const statusColors = { pending: 'var(--yellow)', partial: '#867DEA', settled: 'var(--green)' };
  const statusLabels = { pending: 'Pending', partial: 'Partial', settled: 'Settled ✓' };

  return (
    <div className="settlement-period-card" onClick={() => setOpen(o => !o)}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {fmt.date(s.start_date)} → {fmt.date(s.end_date)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {(s.transactions || []).length} transactions
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-badge ${s.status}`}>{statusLabels[s.status]}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s', color: 'var(--text-muted)' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {open && (
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Balances */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Period Balances</div>
            {(s.balances || []).map(b => (
              <div key={b.user._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{b.user.name} — Paid {fmt.currency(b.total_paid)} / Share {fmt.currency(b.total_share)}</span>
                <span style={{ fontWeight: 700, color: b.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {b.balance >= 0 ? '+' : ''}{fmt.currency(b.balance)}
                </span>
              </div>
            ))}
          </div>

          {/* Transactions */}
          {(s.transactions || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Transactions</div>
              {s.transactions.map(tx => (
                <div key={tx._id || tx.id} className="transaction-card">
                  <div className="tx-arrow" style={{ flex: 1 }}>
                    <span className="tx-from">{tx.from_user_name}</span>
                    <span className="tx-arrow-icon">→</span>
                    <span className="tx-to">{tx.to_user_name}</span>
                  </div>
                  <span className="tx-amount">{fmt.currency(tx.amount)}</span>
                  <button
                    className={`btn btn-sm ${tx.status === 'paid' ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ minWidth: 72 }}
                    onClick={() => onMarkPaid(s, tx)}
                  >
                    {tx.status === 'paid' ? '✓ Paid' : 'Mark Paid'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {(s.transactions || []).length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, padding: '10px 0' }}>
              🎉 All balanced! No payments needed.
            </div>
          )}

          {/* Delete */}
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(s)}>🗑️ Delete Settlement</button>
        </div>
      )}
    </div>
  );
}
