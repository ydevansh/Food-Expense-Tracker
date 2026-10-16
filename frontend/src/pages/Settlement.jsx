import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import api from '../api';
import { fmt, today, balanceClass } from '../utils';

// ─── Status metadata ──────────────────────────────────────────────────────────
const STATUS_COLORS = { active: 'var(--green)', pending: 'var(--yellow)', settled: '#867DEA' };
const STATUS_LABELS = { active: '● Active', pending: '⏳ Pending', settled: '✓ Settled' };

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Settlement() {
  const { showToast, showModal, closeModal, isAdmin, navigate } = useApp();

  const [periods,  setPeriods]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [working,  setWorking]  = useState(false);   // generic async flag

  // New period form
  const now = new Date();
  const [startDate, setStartDate] = useState(now.toISOString().substring(0, 7) + '-01');
  const [endDate,   setEndDate]   = useState(today());

  // ── Load all periods ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try { setPeriods(await api.getPeriods()); }
    catch { showToast('Failed to load periods', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Quick date presets ──────────────────────────────────────────────────────
  const setPreset = (which) => {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const mm  = String(m).padStart(2, '0');
    const last = new Date(y, m, 0).getDate();
    if (which === '1-15')   { setStartDate(`${y}-${mm}-01`); setEndDate(`${y}-${mm}-15`); }
    if (which === '16-end') { setStartDate(`${y}-${mm}-16`); setEndDate(`${y}-${mm}-${last}`); }
    if (which === 'month')  { setStartDate(`${y}-${mm}-01`); setEndDate(`${y}-${mm}-${last}`); }
  };

  // ── Create period ───────────────────────────────────────────────────────────
  const createPeriod = async () => {
    if (!startDate || !endDate) { showToast('Pick a date range', 'error'); return; }
    if (startDate > endDate)    { showToast('Start date must be before end date', 'error'); return; }
    setWorking(true);
    try {
      await api.createPeriod({ start_date: startDate, end_date: endDate });
      showToast('New period created!');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create period', 'error');
    } finally { setWorking(false); }
  };

  // ── Calculate settlement (active → pending) ─────────────────────────────────
  const calculatePeriod = async (period) => {
    setWorking(true);
    try {
      const updated = await api.calculatePeriod(period._id || period.id);
      setPeriods(prev => prev.map(p => (p._id === updated._id || p.id === updated.id) ? updated : p));
      showToast('Settlement calculated! Review and confirm payments below.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Calculation failed', 'error');
    } finally { setWorking(false); }
  };

  // ── Confirm settlement (pending → settled) ──────────────────────────────────
  const confirmSettlement = (period) => {
    showModal({
      title: '✅ Confirm Settlement',
      body: (
        <div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            Confirm that all settlement payments for <strong>{period.label}</strong> have actually been made?
          </p>
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
            {(period.transactions || []).length === 0 ? (
              <span style={{ color: 'var(--green)' }}>🎉 No payments needed — everyone is balanced!</span>
            ) : (
              (period.transactions || []).map(tx => (
                <div key={tx._id || tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{tx.from_user_name} → {tx.to_user_name}</span>
                  <span style={{ fontWeight: 700 }}>{fmt.currency(tx.amount)}</span>
                </div>
              ))
            )}
          </div>
          <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>
            ⚠️ This action is irreversible. The period will be permanently archived.
          </p>
        </div>
      ),
      footer: (
        <>
          <button className="btn btn-secondary flex-1" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={async () => {
            closeModal();
            setWorking(true);
            try {
              const updated = await api.confirmPeriod(period._id || period.id);
              setPeriods(prev => prev.map(p => (p._id === updated._id || p.id === updated.id) ? updated : p));
              showToast('Period settled and archived! ✅');
              // Offer to create next period
              offerNextPeriod(period);
            } catch (err) {
              showToast(err.response?.data?.error || 'Confirm failed', 'error');
            } finally { setWorking(false); }
          }}>Confirm — It's Settled!</button>
        </>
      )
    });
  };

  // ── After settling, offer to start next period ──────────────────────────────
  const offerNextPeriod = (settledPeriod) => {
    // Compute the next period start (day after settled end)
    const [y, m, d] = settledPeriod.end_date.split('-').map(Number);
    const nextStart = new Date(y, m - 1, d + 1);
    const ns = nextStart.toISOString().split('T')[0];
    // End of that calendar month
    const ne = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    showModal({
      title: '🚀 Start Next Period?',
      body: (
        <div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            <strong>{settledPeriod.label}</strong> is now archived. Would you like to start a new period?
          </p>
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Suggested next period:</div>
            <div style={{ fontWeight: 700 }}>{fmt.date(ns)} → {fmt.date(ne)}</div>
          </div>
        </div>
      ),
      footer: (
        <>
          <button className="btn btn-secondary flex-1" onClick={closeModal}>Later</button>
          <button className="btn btn-primary flex-1" onClick={async () => {
            closeModal();
            setWorking(true);
            try {
              await api.createPeriod({ start_date: ns, end_date: ne });
              showToast(`New period ${fmt.date(ns)} → ${fmt.date(ne)} started!`);
              load();
            } catch (err) {
              showToast(err.response?.data?.error || 'Failed to create period', 'error');
            } finally { setWorking(false); }
          }}>Start New Period</button>
        </>
      )
    });
  };

  // ── Toggle individual transaction ───────────────────────────────────────────
  const toggleTransaction = async (period, tx) => {
    const newStatus = tx.status === 'paid' ? 'pending' : 'paid';
    try {
      const updated = await api.updatePeriodTx(period._id || period.id, tx._id || tx.id, newStatus);
      setPeriods(prev => prev.map(p => (p._id === updated._id || p.id === updated.id) ? updated : p));
      showToast(newStatus === 'paid' ? 'Marked as paid ✅' : 'Marked as pending');
    } catch { showToast('Update failed', 'error'); }
  };

  // ── Reopen / Reset Settled Period ──────────────────────────────────────────
  const reopenPeriod = (period) => {
    const currentActiveOrPending = periods.find(p => p.status === 'active' || p.status === 'pending');

    showModal({
      title: '🔄 Reset Settlement & Reopen Period',
      body: (
        <div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            Do you want to reset the settlement for <strong>{period.label}</strong> back to <strong>Active</strong>?
          </p>
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            <div style={{ color: 'var(--green)', fontWeight: 600 }}>
              ✓ All meal records, breakfast/dinner plates, and payments remain preserved.
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              • The archived balance snapshot and transactions will be cleared.
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              • You can edit meals, add missing items, fix prices, and recalculate settlement whenever ready.
            </div>
          </div>
          {currentActiveOrPending && (
            <div style={{ background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--yellow)' }}>
              ⚠️ Note: <strong>{currentActiveOrPending.label}</strong> is currently {currentActiveOrPending.status}. If it has no meals yet, it will be automatically removed so this period can become active.
            </div>
          )}
        </div>
      ),
      footer: (
        <>
          <button className="btn btn-secondary flex-1" onClick={closeModal}>Cancel</button>
          <button
            className="btn btn-danger flex-1"
            style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 700 }}
            onClick={async () => {
              closeModal();
              setWorking(true);
              try {
                await api.reopenPeriod(period._id || period.id, { force: true });
                showToast(`Settlement reset! ${period.label} is now active.`);
                load();
              } catch (err) {
                showToast(err.response?.data?.error || 'Failed to reset settlement', 'error');
              } finally {
                setWorking(false);
              }
            }}
          >
            Reset to Active
          </button>
        </>
      )
    });
  };

  // ── Reset Pending to Active ─────────────────────────────────────────────────
  const resetPendingToActive = async (period) => {
    setWorking(true);
    try {
      await api.reopenPeriod(period._id || period.id);
      showToast('Settlement calculation discarded. Period returned to Active.');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to reset to active', 'error');
    } finally {
      setWorking(false);
    }
  };

  // ── Delete period ───────────────────────────────────────────────────────────
  const deletePeriod = (period) => {
    showModal({
      title: '🗑️ Delete Period',
      body: (
        <div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            Delete the period <strong>{period.label}</strong> ({period.status})?
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Any attached meals will be kept safely and unassigned so you can attach them to a new period.
          </p>
        </div>
      ),
      footer: (
        <>
          <button className="btn btn-secondary flex-1" onClick={closeModal}>Cancel</button>
          <button className="btn btn-danger flex-1" onClick={async () => {
            closeModal();
            setWorking(true);
            try {
              await api.deletePeriod(period._id || period.id, { unassign_meals: true });
              showToast('Period deleted (meals preserved)');
              load();
            } catch (err) {
              showToast(err.response?.data?.error || 'Delete failed', 'error');
            } finally {
              setWorking(false);
            }
          }}>Delete</button>
        </>
      )
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const activePeriod  = periods.find(p => p.status === 'active');
  const pendingPeriod = periods.find(p => p.status === 'pending');
  const settledPeriods = periods.filter(p => p.status === 'settled');

  return (
    <div className="page-section">

      {/* ── Public Read-Only Notice ───────────────────────────────────── */}
      {!isAdmin && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>👁️</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Viewing settlement history in <strong>Read-Only Mode</strong>. Log in as administrator to calculate, confirm, or reset settlements.
            </span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/admin/login')}
            style={{ color: '#a5b4fc', borderColor: 'rgba(99, 102, 241, 0.4)', fontWeight: 600 }}
          >
            🔐 Admin Login
          </button>
        </div>
      )}

      {/* ── Active Period Actions ─────────────────────────────────────── */}
      {activePeriod && (
        <ActivePeriodCard
          period={activePeriod}
          isAdmin={isAdmin}
          onCalculate={() => calculatePeriod(activePeriod)}
          onDelete={() => deletePeriod(activePeriod)}
          working={working}
        />
      )}

      {/* ── Pending Period: review & confirm ─────────────────────────── */}
      {pendingPeriod && (
        <PendingPeriodCard
          period={pendingPeriod}
          isAdmin={isAdmin}
          onToggleTx={(tx) => toggleTransaction(pendingPeriod, tx)}
          onConfirm={() => confirmSettlement(pendingPeriod)}
          onRecalculate={() => calculatePeriod(pendingPeriod)}
          onResetToActive={() => resetPendingToActive(pendingPeriod)}
          working={working}
        />
      )}

      {/* ── Create New Period ─────────────────────────────────────────── */}
      {!activePeriod && !pendingPeriod && (
        isAdmin ? (
          <div className="card-elevated">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🆕 Start New Accounting Period</div>
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPreset('1-15')}>1–15</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPreset('16-end')}>16–End</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPreset('month')}>Full Month</button>
            </div>
            <button className="btn btn-primary btn-full" onClick={createPeriod} disabled={working}>
              {working ? 'Creating...' : '🚀 Start Period'}
            </button>
          </div>
        ) : (
          <div className="card-elevated" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💰</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>No Active Period Currently Running</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, marginBottom: 14 }}>
              An administrator must start a new accounting period to track running balances.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/login')}>
              🔐 Log In to Start Period
            </button>
          </div>
        )
      )}

      {/* ── Settled History ───────────────────────────────────────────── */}
      {loading ? (
        <div className="page-loader"><div className="loader-spinner" /></div>
      ) : settledPeriods.length > 0 && (
        <div>
          <div className="section-title">📂 Settled History</div>
          <div className="mt-8 settlement-grid">
            {settledPeriods.map(p => (
              <SettledPeriodCard
                key={p._id || p.id}
                period={p}
                isAdmin={isAdmin}
                onReopen={() => reopenPeriod(p)}
                onDelete={() => deletePeriod(p)}
                working={working}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && periods.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h3>No periods yet</h3>
          <p>Create your first accounting period above to start tracking balances</p>
        </div>
      )}
    </div>
  );
}

// ─── Active period card ───────────────────────────────────────────────────────
function ActivePeriodCard({ period, onCalculate, onDelete, working, isAdmin }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="card-elevated" style={{ borderLeft: '3px solid var(--green)' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', marginBottom: open ? 16 : 0 }}
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            ● Active Period
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{period.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {fmt.date(period.start_date)} → {fmt.date(period.end_date)}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s', color: 'var(--text-muted)', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {open && (
        <div onClick={e => e.stopPropagation()}>
          {/* Live Balances */}
          <BalanceList balances={period.balances} />

          <div className="info-box" style={{ marginTop: 10, marginBottom: 12 }}>
            <strong>Total period expense:</strong> {fmt.currency(period.total_expense || 0)}
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary flex-1"
                onClick={onCalculate}
                disabled={working}
              >
                {working ? 'Calculating...' : '📊 Calculate & Preview Settlement'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={onDelete} disabled={working} title="Only works if no meals are attached">
                🗑️
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pending period card ──────────────────────────────────────────────────────
function PendingPeriodCard({ period, onToggleTx, onConfirm, onRecalculate, onResetToActive, working }) {
  const [open, setOpen] = useState(true);

  const allPaid = (period.transactions || []).every(t => t.status === 'paid');

  return (
    <div className="card-elevated" style={{ borderLeft: '3px solid var(--yellow)' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', marginBottom: open ? 16 : 0 }}
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            ⏳ Awaiting Confirmation
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{period.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {fmt.date(period.start_date)} → {fmt.date(period.end_date)}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s', color: 'var(--text-muted)', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {open && (
        <div onClick={e => e.stopPropagation()}>
          {/* Balances */}
          <BalanceList balances={period.balances} />

          {/* Transactions */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Settlement Transactions
            </div>
            {(period.transactions || []).length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, padding: '10px 0' }}>
                🎉 All balanced — no payments needed!
              </div>
            ) : (
              (period.transactions || []).map(tx => (
                <div key={tx._id || tx.id} className="transaction-card">
                  <div className="tx-arrow" style={{ flex: 1 }}>
                    <span className="tx-from">{tx.from_user_name}</span>
                    <span className="tx-arrow-icon">→</span>
                    <span className="tx-to">{tx.to_user_name}</span>
                  </div>
                  <span className="tx-amount">{fmt.currency(tx.amount)}</span>
                  <button
                    className={`btn btn-sm ${tx.status === 'paid' ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ minWidth: 88 }}
                    onClick={() => onToggleTx(tx)}
                  >
                    {tx.status === 'paid' ? '✓ Paid' : 'Mark Paid'}
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={onResetToActive} disabled={working} title="Discard calculations and return to active">
              ↩️ Back to Active
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onRecalculate} disabled={working}>
              🔄 Recalculate
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={onConfirm}
              disabled={working}
            >
              {working ? 'Working...' : '✅ Confirm — All Paid & Settle'}
            </button>
          </div>

          {!allPaid && (period.transactions || []).length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              You can confirm even if not all transactions are individually marked — confirmation archives the period.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Settled period card ──────────────────────────────────────────────────────
function SettledPeriodCard({ period, onReopen, onDelete, working }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="settlement-period-card" onClick={() => setOpen(o => !o)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 12 : 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{period.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {fmt.date(period.start_date)} → {fmt.date(period.end_date)}
          </div>
          {period.settled_at && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Settled on {fmt.date(period.settled_at?.substring(0, 10))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="status-badge settled">✓ Settled</span>
          {period.total_expense != null && (
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {fmt.currency(period.total_expense)}
            </span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s', color: 'var(--text-muted)' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {open && (
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Stored balance snapshot */}
          <BalanceList balances={period.balances} settled />

          {/* Transactions (read-only) */}
          {(period.transactions || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Settlement Transactions
              </div>
              {period.transactions.map(tx => (
                <div key={tx._id || tx.id} className="transaction-card">
                  <div className="tx-arrow" style={{ flex: 1 }}>
                    <span className="tx-from">{tx.from_user_name}</span>
                    <span className="tx-arrow-icon">→</span>
                    <span className="tx-to">{tx.to_user_name}</span>
                  </div>
                  <span className="tx-amount">{fmt.currency(tx.amount)}</span>
                  <span className="status-badge settled" style={{ fontSize: 11 }}>✓ Paid</span>
                </div>
              ))}
            </div>
          )}

          {(period.transactions || []).length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>
              🎉 Was balanced — no payments were needed
            </div>
          )}

          {/* Authority Actions: Reopen / Reset Settlement & Delete */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm flex-1"
              style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', fontWeight: 600 }}
              onClick={(e) => { e.stopPropagation(); onReopen(); }}
              disabled={working}
              title="Reset settlement back to active so you can fix errors and recalculate"
            >
              🔄 Reset / Reopen Settlement
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              disabled={working}
              title="Delete this period (meals will be unassigned and kept)"
            >
              🗑️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable balance list ────────────────────────────────────────────────────
function BalanceList({ balances, settled }) {
  if (!balances || balances.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
        {settled ? 'Final Balances (Archived)' : 'Current Period Balances'}
      </div>
      {balances.map(b => (
        <div key={b.user._id || b.user.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 8 }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {b.user.name}
            <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.7 }}>
              Paid {fmt.currency(b.total_paid)} / Share {fmt.currency(b.total_share)}
            </span>
          </span>
          <span style={{ fontWeight: 700, color: b.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {b.balance >= 0 ? '+' : ''}{fmt.currency(b.balance)}
          </span>
        </div>
      ))}
    </div>
  );
}
