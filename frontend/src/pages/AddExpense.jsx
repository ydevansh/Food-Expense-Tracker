import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../App';
import api from '../api';
import { fmt, today, calculateShares, mealIcon } from '../utils';

export default function AddExpense() {
  const { users, showToast } = useApp();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;

  // Form state
  const [date,        setDate]        = useState(today());
  const [mealType,    setMealType]    = useState('dinner');
  const [plates,      setPlates]      = useState(2);
  const [selectedIds, setSelectedIds] = useState([]);
  const [payments,    setPayments]    = useState({});
  const [notes,       setNotes]       = useState('');
  const [prices,      setPrices]      = useState({ breakfast: 50, dinner: 70 });
  const [loading,     setLoading]     = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Load current prices on mount / date change
  useEffect(() => {
    api.getCurrentPrices(date).then(setPrices).catch(console.error);
  }, [date]);

  // Load existing meal for editing
  useEffect(() => {
    if (!isEdit || users.length === 0) return;
    api.getMeal(editId).then(meal => {
      setDate(meal.date);
      setMealType(meal.meal_type || meal.mealType);
      setPlates(meal.number_of_plates || meal.numberOfPlates);
      const pIds = (meal.participants || []).map(p => (p.user_id || p.userId).toString());
      setSelectedIds(pIds);
      const payMap = {};
      (meal.payments || []).forEach(p => {
        payMap[(p.user_id || p.userId).toString()] = p.amount_paid || p.amountPaid || 0;
      });
      setPayments(payMap);
      setNotes(meal.notes || '');
    }).catch(console.error).finally(() => setInitialLoad(false));
  }, [editId, users]);

  useEffect(() => { if (!isEdit) setInitialLoad(false); }, [isEdit]);

  // Init payments to 0 for all users
  useEffect(() => {
    if (users.length && !isEdit) {
      const map = {};
      users.forEach(u => { map[u._id || u.id] = 0; });
      setPayments(map);
    }
  }, [users, isEdit]);

  // ── Derived calculations ──────────────────────────────────────
  const pricePerPlate = prices[mealType] || 0;
  const totalAmount   = Math.round(pricePerPlate * plates * 100) / 100;
  const shares        = selectedIds.length > 0 ? calculateShares(totalAmount, selectedIds) : {};

  const totalPaymentEntered = Object.values(payments).reduce((s, v) => s + Number(v || 0), 0);

  // ── Handlers ──────────────────────────────────────────────────
  const toggleUser = (uid) => {
    const s = uid.toString();
    setSelectedIds(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const setPayment = (uid, val) => {
    setPayments(prev => ({ ...prev, [uid.toString()]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) { showToast('Select at least one person who ate', 'error'); return; }
    if (Math.abs(totalPaymentEntered - totalAmount) > 0.5 && totalPaymentEntered > 0) {
      showToast(`Payment total ₹${totalPaymentEntered.toFixed(2)} ≠ meal total ₹${totalAmount.toFixed(2)}`, 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        date, meal_type: mealType, number_of_plates: plates,
        participant_ids: selectedIds,
        payments: users.map(u => ({
          user_id:     u._id || u.id,
          amount_paid: Number(payments[(u._id || u.id).toString()] || 0)
        })),
        notes: notes.trim() || null
      };

      if (isEdit) {
        await api.updateMeal(editId, payload);
        showToast('Meal updated!');
      } else {
        await api.createMeal(payload);
        showToast('Meal added!');
      }
      navigate('/');
    } catch (err) {
      showToast(err.response?.data?.error || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoad) {
    return <div className="page-loader"><div className="loader-spinner" /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="page-section">
      <div className="expense-form-grid">
        <div className="form-col">
          {/* Date */}
          <div className="form-group">
            <label className="form-label">📅 Date</label>
            <input type="date" className="form-input" value={date} max={today()} onChange={e => setDate(e.target.value)} required />
          </div>

          {/* Meal Type */}
          <div className="form-group">
            <label className="form-label">Meal Type</label>
            <div className="meal-type-selector">
              {['breakfast', 'dinner'].map(t => (
                <button
                  key={t} type="button"
                  className={`meal-type-btn ${mealType === t ? 'selected' : ''}`}
                  onClick={() => setMealType(t)}
                >
                  <span className="icon">{mealIcon(t)}</span>
                  <span className="label">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                  <span className="price">{fmt.currency(prices[t])} / plate</span>
                </button>
              ))}
            </div>
          </div>

          {/* Plates */}
          <div className="form-group">
            <label className="form-label">Number of Plates</label>
            <div className="number-stepper">
              <button type="button" className="stepper-btn" onClick={() => setPlates(p => Math.max(1, p - 1))}>−</button>
              <input
                type="number" className="stepper-value"
                value={plates} min="1" max="20"
                onChange={e => setPlates(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button type="button" className="stepper-btn" onClick={() => setPlates(p => p + 1)}>+</button>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">📝 Notes (optional)</label>
            <textarea className="form-textarea" placeholder="e.g. Devansh absent, extra plate..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="form-col">
          {/* Who Ate */}
          <div className="form-group">
            <label className="form-label">Who Ate?</label>
            <div className="check-group">
              {users.map(u => {
                const uid     = (u._id || u.id).toString();
                const checked = selectedIds.includes(uid);
                return (
                  <label key={uid} className={`check-pill ${checked ? 'selected' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleUser(uid)} />
                    {u.name}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Calculation Preview */}
          {selectedIds.length > 0 && (
            <div className="calc-preview">
              <div className="calc-total">{fmt.currency(totalAmount)}</div>
              <div className="calc-subtitle">
                {plates} plate{plates !== 1 ? 's' : ''} × {fmt.currency(pricePerPlate)} ÷ {selectedIds.length} people
              </div>
              <div className="calc-shares">
                {users.map((u) => {
                  const uid   = (u._id || u.id).toString();
                  const share = shares[uid] || 0;
                  return (
                    <div key={uid} className="calc-share-row">
                      <span className="user-name">{u.name}</span>
                      <span className={`amount ${share === 0 ? 'zero' : ''}`}>{fmt.currency(share)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="form-group">
            <label className="form-label">💳 Who Paid? (enter amounts)</label>
            <div className="payment-section">
              {users.map(u => {
                const uid = (u._id || u.id).toString();
                return (
                  <div key={uid} className="payment-row">
                    <span className="payment-user-name">{u.name}</span>
                    <input
                      type="number" className="payment-input"
                      placeholder="₹0" min="0" step="0.01"
                      value={payments[uid] || ''}
                      onChange={e => setPayment(uid, e.target.value)}
                    />
                  </div>
                );
              })}
              {totalPaymentEntered > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Payment Total</span>
                  <span style={{ fontWeight: 700, color: Math.abs(totalPaymentEntered - totalAmount) < 0.5 ? 'var(--green)' : 'var(--red)' }}>
                    {fmt.currency(totalPaymentEntered)} / {fmt.currency(totalAmount)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || selectedIds.length === 0}>
        {loading ? 'Saving...' : isEdit ? '✅ Update Meal' : '✅ Save Meal'}
      </button>
    </form>
  );
}
