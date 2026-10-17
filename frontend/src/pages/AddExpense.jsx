import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../App';
import api from '../api';
import { fmt, today, mealIcon } from '../utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Distribute totalCents equally, penny-correct */
function equalSplit(totalAmount, userIds) {
  const n = userIds.length;
  if (n === 0) return {};
  const totalCents = Math.round(totalAmount * 100);
  const base       = Math.floor(totalCents / n);
  const extra      = totalCents - base * n;
  const shares     = {};
  userIds.forEach((uid, i) => {
    shares[uid] = (base + (i < extra ? 1 : 0)) / 100;
  });
  return shares;
}

/** Per-item quantity-based split */
function quantitySplit(quantityMap, unitPrice) {
  const totalQty   = Object.values(quantityMap).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalCents = Math.round(totalQty * unitPrice * 100);
  const shares     = {};
  const keys       = Object.keys(quantityMap);
  let assigned     = 0;
  keys.forEach((uid, i) => {
    const qty = Number(quantityMap[uid]) || 0;
    const isLast = i === keys.length - 1;
    const cents  = isLast
      ? totalCents - assigned
      : Math.round((qty / (totalQty || 1)) * totalCents);
    shares[uid] = cents / 100;
    assigned += cents;
  });
  return shares;
}

/** Multi-item quantity split */
function multiItemSplit(items, participantQtys) {
  const userTotals = {};
  items.forEach((item, idx) => {
    const pqty = participantQtys[idx] || {};
    Object.keys(pqty).forEach(uid => {
      userTotals[uid] = (userTotals[uid] || 0) + (Number(pqty[uid]) || 0) * item.unitPrice;
    });
  });
  const rawTotal   = Object.values(userTotals).reduce((s, v) => s + v, 0);
  const totalCents = Math.round(rawTotal * 100);
  const keys       = Object.keys(userTotals);
  const shares     = {};
  let assigned     = 0;
  keys.forEach((uid, i) => {
    const isLast = i === keys.length - 1;
    const cents  = isLast
      ? totalCents - assigned
      : Math.round((userTotals[uid] / (rawTotal || 1)) * totalCents);
    shares[uid] = cents / 100;
    assigned += cents;
  });
  return shares;
}

const UNITS = ['plate', 'roti', 'item', 'piece', 'bowl'];

const EMPTY_ITEM = () => ({ description: '', quantity: 1, unitPrice: 0, unit: 'roti' });

// ─── Component ────────────────────────────────────────────────────────────────
export default function AddExpense() {
  const { users, showToast } = useApp();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;

  // ── Core fields ────────────────────────────────────────────────────────────
  const [date,       setDate]       = useState(today());
  const [mealType,   setMealType]   = useState('dinner');
  const [foodType,   setFoodType]   = useState('regular');  // 'regular' | 'custom'

  // ── Regular meal ───────────────────────────────────────────────────────────
  const [plates,     setPlates]     = useState(2);
  const [unitPrice,  setUnitPrice]  = useState(70); // editable per-entry price
  const [defaultPrices, setDefaultPrices] = useState({ breakfast: 50, dinner: 70 });

  // ── Custom meal ────────────────────────────────────────────────────────────
  const [pricingMethod, setPricingMethod] = useState('per_plate'); // 'per_plate'|'per_item'|'manual'
  const [splitMethod,   setSplitMethod]   = useState('equal');     // 'equal'|'quantity'
  const [description,   setDescription]   = useState('');
  const [customUnit,    setCustomUnit]     = useState('plate');
  const [customQty,     setCustomQty]      = useState(1);
  const [customUnitPrice, setCustomUnitPrice] = useState(0);
  const [manualTotal,  setManualTotal]    = useState(0);

  // Per-participant quantities (for per_item single mode)
  const [perPersonQty, setPerPersonQty] = useState({}); // { [userId]: qty }

  // Multi-item mode
  const [items, setItems]               = useState([EMPTY_ITEM()]); // [{ description, quantity, unitPrice, unit }]
  const [itemParticipantQtys, setItemParticipantQtys] = useState([{}]); // [{ [userId]: qty }]
  const [isMultiItem, setIsMultiItem]   = useState(false);

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState([]);
  const [payments,    setPayments]      = useState({});
  const [notes,       setNotes]         = useState('');
  const [loading,     setLoading]       = useState(false);
  const [initialLoad, setInitialLoad]   = useState(true);

  // ── Load default prices ────────────────────────────────────────────────────
  useEffect(() => {
    api.getCurrentPrices(date).then(prices => {
      setDefaultPrices(prices);
      if (!isEdit) {
        setUnitPrice(prices[mealType] || (mealType === 'breakfast' ? 50 : 70));
      }
    }).catch(console.error);
  }, [date]);

  // When meal type changes in regular mode, update unit price to default
  useEffect(() => {
    if (!isEdit && foodType === 'regular') {
      setUnitPrice(defaultPrices[mealType] || (mealType === 'breakfast' ? 50 : 70));
    }
  }, [mealType, foodType]);

  // ── Load existing meal for edit ────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || users.length === 0) return;
    api.getMeal(editId).then(meal => {
      setDate(meal.date);
      const mt = meal.meal_type || meal.mealType;
      setMealType(mt);
      const ft = meal.food_type || meal.foodType || 'regular';
      setFoodType(ft);

      if (ft === 'regular') {
        setPlates(meal.number_of_plates || meal.numberOfPlates || 1);
        setUnitPrice(meal.price_per_plate || meal.pricePerPlate || 70);
      } else {
        const pm = meal.pricing_method || meal.pricingMethod;
        setPricingMethod(pm || 'per_plate');
        setSplitMethod(meal.split_method || meal.splitMethod || 'equal');
        setDescription(meal.description || '');

        const mealItems = meal.items || [];
        if (mealItems.length > 1) {
          setIsMultiItem(true);
          setItems(mealItems.map(it => ({
            description: it.description || '',
            quantity:    it.quantity    || 1,
            unitPrice:   it.unitPrice   || 0,
            unit:        it.unit        || 'plate'
          })));
          setItemParticipantQtys(mealItems.map(() => ({})));
        } else if (mealItems.length === 1) {
          const it = mealItems[0];
          if (pm === 'per_item' || pm === 'per_plate') {
            setCustomUnitPrice(it.unitPrice || 0);
            setCustomQty(it.quantity || 1);
            setCustomUnit(it.unit || 'plate');
            // Restore per-person quantities
            const qMap = {};
            (meal.participants || []).forEach(p => {
              const uid = (p.user_id || p.userId).toString();
              qMap[uid] = p.quantity || 0;
            });
            setPerPersonQty(qMap);
          } else if (pm === 'manual') {
            setManualTotal(meal.total_amount || meal.totalAmount || 0);
          }
        }
      }

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

  useEffect(() => {
    if (users.length && !isEdit) {
      const map = {};
      users.forEach(u => { map[u._id || u.id] = 0; });
      setPayments(map);
    }
  }, [users, isEdit]);

  // ── Toggle participant ─────────────────────────────────────────────────────
  const toggleUser = (uid) => {
    const s = uid.toString();
    setSelectedIds(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const setPayment = (uid, val) => {
    setPayments(prev => ({ ...prev, [uid.toString()]: val }));
  };

  // ── Live calculations ──────────────────────────────────────────────────────
  const calcResult = (() => {
    if (selectedIds.length === 0) return { total: 0, shares: {}, breakdown: '' };

    if (foodType === 'regular') {
      const total = Math.round(unitPrice * plates * 100) / 100;
      const shares = equalSplit(total, selectedIds);
      return {
        total,
        shares,
        breakdown: `${plates} plate${plates !== 1 ? 's' : ''} × ${fmt.currency(unitPrice)}`
      };
    }

    // Custom
    if (isMultiItem) {
      const total = Math.round(items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0) * 100) / 100;
      let shares;
      const hasPerPersonQtys = itemParticipantQtys.some(pqty => Object.values(pqty).some(v => v > 0));
      if (splitMethod === 'quantity' && hasPerPersonQtys) {
        shares = multiItemSplit(items, itemParticipantQtys);
      } else {
        shares = equalSplit(total, selectedIds);
      }
      return { total, shares, breakdown: `${items.length} item${items.length !== 1 ? 's' : ''}` };
    }

    switch (pricingMethod) {
      case 'per_plate': {
        const total = Math.round(customQty * customUnitPrice * 100) / 100;
        const shares = splitMethod === 'quantity'
          ? quantitySplit(
              Object.fromEntries(selectedIds.map(uid => [uid, perPersonQty[uid] || 0])),
              customUnitPrice
            )
          : equalSplit(total, selectedIds);
        return {
          total, shares,
          breakdown: `${customQty} ${customUnit}${customQty !== 1 ? 's' : ''} × ${fmt.currency(customUnitPrice)}`
        };
      }
      case 'per_item': {
        const qMap = Object.fromEntries(selectedIds.map(uid => [uid, perPersonQty[uid] || 0]));
        const totalQty = Object.values(qMap).reduce((s, v) => s + (Number(v) || 0), 0);
        const total = Math.round(totalQty * customUnitPrice * 100) / 100;
        const shares = quantitySplit(qMap, customUnitPrice);
        return {
          total, shares,
          breakdown: `${totalQty} ${customUnit}${totalQty !== 1 ? 's' : ''} × ${fmt.currency(customUnitPrice)} (per person)`
        };
      }
      case 'manual': {
        const total = Number(manualTotal) || 0;
        const shares = equalSplit(total, selectedIds);
        return { total, shares, breakdown: 'Manual total, equal split' };
      }
      default:
        return { total: 0, shares: {}, breakdown: '' };
    }
  })();

  const totalPaymentEntered = Object.values(payments).reduce((s, v) => s + Number(v || 0), 0);

  // ── Item management ────────────────────────────────────────────────────────
  const addItem = () => {
    setItems(prev => [...prev, EMPTY_ITEM()]);
    setItemParticipantQtys(prev => [...prev, {}]);
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setItemParticipantQtys(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const updateItemParticipantQty = (itemIdx, uid, val) => {
    setItemParticipantQtys(prev => prev.map((pqty, i) =>
      i === itemIdx ? { ...pqty, [uid]: val } : pqty
    ));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      showToast('Select at least one person who ate', 'error');
      return;
    }
    if (calcResult.total <= 0) {
      showToast('Total amount must be greater than ₹0', 'error');
      return;
    }
    if (totalPaymentEntered > 0 && Math.abs(totalPaymentEntered - calcResult.total) > 0.5) {
      showToast(`Payment total ₹${totalPaymentEntered.toFixed(2)} ≠ meal total ₹${calcResult.total.toFixed(2)}`, 'error');
      return;
    }

    setLoading(true);
    try {
      let payload = {
        date,
        meal_type:       mealType,
        foodType,
        description:     description.trim() || null,
        participant_ids: selectedIds,
        payments: users.map(u => ({
          user_id:     u._id || u.id,
          amount_paid: Number(payments[(u._id || u.id).toString()] || 0)
        })),
        notes: notes.trim() || null,
        splitMethod
      };

      if (foodType === 'regular') {
        payload.pricePerPlate  = unitPrice;
        payload.numberOfPlates = plates;
      } else {
        payload.pricingMethod = pricingMethod;

        if (isMultiItem) {
          payload.items = items.map((it, idx) => ({
            description:    it.description,
            quantity:       Number(it.quantity) || 0,
            unitPrice:      Number(it.unitPrice) || 0,
            unit:           it.unit,
            participantQtys: itemParticipantQtys[idx] || {}
          }));
        } else if (pricingMethod === 'per_plate') {
          payload.quantity   = customQty;
          payload.unitPrice  = customUnitPrice;
          payload.unit       = customUnit;
          if (splitMethod === 'quantity') {
            payload.participantQuantities = Object.fromEntries(
              selectedIds.map(uid => [uid, perPersonQty[uid] || 0])
            );
          }
        } else if (pricingMethod === 'per_item') {
          payload.unitPrice  = customUnitPrice;
          payload.unit       = customUnit;
          payload.participantQuantities = Object.fromEntries(
            selectedIds.map(uid => [uid, perPersonQty[uid] || 0])
          );
        } else if (pricingMethod === 'manual') {
          payload.manualTotal = manualTotal;
        }
      }

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

  if (initialLoad) return <div className="page-loader"><div className="loader-spinner" /></div>;

  const isRegular = foodType === 'regular';
  const isCustom  = foodType === 'custom';

  return (
    <form onSubmit={handleSubmit} className="page-section add-expense-form">

      {/* ── Row 1: Date + Meal Type ──────────────────────────────────────── */}
      <div className="ae-row">
        <div className="form-group ae-half">
          <label className="form-label">📅 Date</label>
          <input
            type="date" className="form-input"
            value={date} max={today()}
            onChange={e => setDate(e.target.value)} required
          />
        </div>

        <div className="form-group ae-half">
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
                <span className="price">{fmt.currency(defaultPrices[t])} default</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Food Type ─────────────────────────────────────────────── */}
      <div className="form-group">
        <label className="form-label">🍽️ Food Type</label>
        <div className="food-type-selector">
          <button
            type="button"
            className={`food-type-btn ${isRegular ? 'selected' : ''}`}
            onClick={() => setFoodType('regular')}
          >
            <span className="ft-icon">🏠</span>
            <div>
              <div className="ft-title">Regular Meal</div>
              <div className="ft-sub">Standard plates at default price</div>
            </div>
          </button>
          <button
            type="button"
            className={`food-type-btn ${isCustom ? 'selected' : ''}`}
            onClick={() => setFoodType('custom')}
          >
            <span className="ft-icon">✨</span>
            <div>
              <div className="ft-title">Custom Meal</div>
              <div className="ft-sub">Roti, special food, different pricing</div>
            </div>
          </button>
        </div>
      </div>

      {/* ── Regular Meal Fields ──────────────────────────────────────────── */}
      {isRegular && (
        <div className="ae-row">
          <div className="form-group ae-third">
            <label className="form-label">🔢 Number of Plates</label>
            <div className="number-stepper">
              <button type="button" className="stepper-btn" onClick={() => setPlates(p => Math.max(1, p - 1))}>−</button>
              <input
                type="number" className="stepper-value"
                value={plates} min="1" max="50"
                onChange={e => setPlates(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button type="button" className="stepper-btn" onClick={() => setPlates(p => p + 1)}>+</button>
            </div>
          </div>

          <div className="form-group ae-third">
            <label className="form-label">
              💰 Price / Plate
              {Math.abs(unitPrice - defaultPrices[mealType]) > 0.01 && (
                <span className="price-custom-badge"> ✏️ custom</span>
              )}
            </label>
            <div className="price-input-wrap">
              <span className="price-prefix">₹</span>
              <input
                type="number" className="form-input price-input"
                value={unitPrice} min="0" step="0.50"
                onChange={e => setUnitPrice(Number(e.target.value) || 0)}
              />
              {Math.abs(unitPrice - defaultPrices[mealType]) > 0.01 && (
                <button
                  type="button" className="btn-reset-price"
                  onClick={() => setUnitPrice(defaultPrices[mealType])}
                  title="Reset to default price"
                >↺</button>
              )}
            </div>
            <div className="price-hint">Default: {fmt.currency(defaultPrices[mealType])}</div>
          </div>

          <div className="form-group ae-third">
            <label className="form-label">💵 Subtotal</label>
            <div className="subtotal-display">{fmt.currency(calcResult.total)}</div>
            <div className="price-hint">{plates} × {fmt.currency(unitPrice)}</div>
          </div>
        </div>
      )}

      {/* ── Custom Meal Fields ───────────────────────────────────────────── */}
      {isCustom && (
        <>
          {/* Description */}
          <div className="form-group">
            <label className="form-label">📝 Food Description</label>
            <input
              type="text" className="form-input"
              placeholder="e.g. Roti and sabzi, Special dinner, Rice and curry"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Multi-item toggle */}
          <div className="multi-item-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={isMultiItem}
                onChange={e => setIsMultiItem(e.target.checked)}
              />
              <span className="toggle-switch" />
              <span className="toggle-text">Multiple food items in this meal</span>
            </label>
          </div>

          {/* ── Pricing Method (single item) ────────────────────────────── */}
          {!isMultiItem && (
            <>
              <div className="form-group">
                <label className="form-label">📐 Pricing Method</label>
                <div className="pricing-method-selector">
                  <button
                    type="button"
                    className={`pm-btn ${pricingMethod === 'per_plate' ? 'selected' : ''}`}
                    onClick={() => { setPricingMethod('per_plate'); setSplitMethod('equal'); }}
                  >
                    <span>🍽️</span>
                    <div><div className="pm-title">Per Plate</div><div className="pm-sub">N plates × price</div></div>
                  </button>
                  <button
                    type="button"
                    className={`pm-btn ${pricingMethod === 'per_item' ? 'selected' : ''}`}
                    onClick={() => { setPricingMethod('per_item'); setSplitMethod('quantity'); }}
                  >
                    <span>🫓</span>
                    <div><div className="pm-title">Per Item</div><div className="pm-sub">Per roti / piece (each person's qty)</div></div>
                  </button>
                  <button
                    type="button"
                    className={`pm-btn ${pricingMethod === 'manual' ? 'selected' : ''}`}
                    onClick={() => { setPricingMethod('manual'); setSplitMethod('equal'); }}
                  >
                    <span>✏️</span>
                    <div><div className="pm-title">Manual Total</div><div className="pm-sub">Enter total, split equally</div></div>
                  </button>
                </div>
              </div>

              {/* Per Plate fields */}
              {pricingMethod === 'per_plate' && (
                <div className="ae-row">
                  <div className="form-group ae-quarter">
                    <label className="form-label">Qty</label>
                    <input
                      type="number" className="form-input"
                      value={customQty} min="1"
                      onChange={e => setCustomQty(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="form-group ae-quarter">
                    <label className="form-label">Unit</label>
                    <select className="form-input" value={customUnit} onChange={e => setCustomUnit(e.target.value)}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="form-group ae-quarter">
                    <label className="form-label">Price / unit</label>
                    <div className="price-input-wrap">
                      <span className="price-prefix">₹</span>
                      <input
                        type="number" className="form-input price-input"
                        value={customUnitPrice} min="0" step="0.50"
                        onChange={e => setCustomUnitPrice(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="form-group ae-quarter">
                    <label className="form-label">Total</label>
                    <div className="subtotal-display">{fmt.currency(calcResult.total)}</div>
                  </div>
                </div>
              )}

              {/* Per Item fields – individual quantities */}
              {pricingMethod === 'per_item' && (
                <>
                  <div className="ae-row">
                    <div className="form-group ae-half">
                      <label className="form-label">Unit</label>
                      <select className="form-input" value={customUnit} onChange={e => setCustomUnit(e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="form-group ae-half">
                      <label className="form-label">Price / {customUnit}</label>
                      <div className="price-input-wrap">
                        <span className="price-prefix">₹</span>
                        <input
                          type="number" className="form-input price-input"
                          value={customUnitPrice} min="0" step="0.50"
                          onChange={e => setCustomUnitPrice(Number(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">How many {customUnit}s did each person eat?</label>
                    <div className="per-person-qty">
                      {users.map(u => {
                        const uid = (u._id || u.id).toString();
                        const isParticipant = selectedIds.includes(uid);
                        return (
                          <div key={uid} className={`ppq-row ${!isParticipant ? 'ppq-disabled' : ''}`}>
                            <span className="ppq-name">{u.name}</span>
                            <div className="number-stepper ppq-stepper">
                              <button type="button" className="stepper-btn"
                                onClick={() => setPerPersonQty(p => ({ ...p, [uid]: Math.max(0, (Number(p[uid]) || 0) - 1) }))}
                              >−</button>
                              <input
                                type="number" className="stepper-value"
                                value={perPersonQty[uid] || 0} min="0"
                                disabled={!isParticipant}
                                onChange={e => setPerPersonQty(p => ({ ...p, [uid]: Number(e.target.value) || 0 }))}
                              />
                              <button type="button" className="stepper-btn"
                                onClick={() => setPerPersonQty(p => ({ ...p, [uid]: (Number(p[uid]) || 0) + 1 }))}
                              >+</button>
                            </div>
                            <span className="ppq-amount">
                              {fmt.currency((Number(perPersonQty[uid]) || 0) * customUnitPrice)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Manual Total */}
              {pricingMethod === 'manual' && (
                <div className="form-group ae-half">
                  <label className="form-label">💰 Total Meal Cost</label>
                  <div className="price-input-wrap">
                    <span className="price-prefix">₹</span>
                    <input
                      type="number" className="form-input price-input"
                      value={manualTotal} min="0" step="1"
                      onChange={e => setManualTotal(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              )}

              {/* Split method (for per_plate) */}
              {pricingMethod === 'per_plate' && (
                <div className="form-group">
                  <label className="form-label">⚖️ Split Method</label>
                  <div className="split-method-selector">
                    <button
                      type="button"
                      className={`sm-btn ${splitMethod === 'equal' ? 'selected' : ''}`}
                      onClick={() => setSplitMethod('equal')}
                    >
                      <span>⚖️</span> Equal Split
                    </button>
                    <button
                      type="button"
                      className={`sm-btn ${splitMethod === 'quantity' ? 'selected' : ''}`}
                      onClick={() => setSplitMethod('quantity')}
                    >
                      <span>📊</span> Quantity-Based
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Multi-item mode ──────────────────────────────────────────── */}
          {isMultiItem && (
            <div className="multi-items-container">
              <div className="multi-items-header">
                <span>Food Items</span>
                <button type="button" className="btn btn-sm btn-secondary" onClick={addItem}>
                  + Add Item
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="food-item-card">
                  <div className="fic-header">
                    <span className="fic-num">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" className="fic-remove" onClick={() => removeItem(idx)}>✕</button>
                    )}
                  </div>

                  <div className="ae-row">
                    <div className="form-group ae-flex2">
                      <label className="form-label">Description</label>
                      <input
                        type="text" className="form-input"
                        placeholder="e.g. Roti, Extra sabzi"
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                      />
                    </div>
                    <div className="form-group ae-flex1">
                      <label className="form-label">Unit</label>
                      <select className="form-input" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="ae-row">
                    <div className="form-group ae-third">
                      <label className="form-label">Quantity</label>
                      <input
                        type="number" className="form-input"
                        value={item.quantity} min="0"
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value) || 0)}
                      />
                    </div>
                    <div className="form-group ae-third">
                      <label className="form-label">Price / {item.unit}</label>
                      <div className="price-input-wrap">
                        <span className="price-prefix">₹</span>
                        <input
                          type="number" className="form-input price-input"
                          value={item.unitPrice} min="0" step="0.50"
                          onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div className="form-group ae-third">
                      <label className="form-label">Item Total</label>
                      <div className="subtotal-display sm">
                        {fmt.currency((item.quantity || 0) * (item.unitPrice || 0))}
                      </div>
                    </div>
                  </div>

                  {/* Per-person qty for this item (optional) */}
                  <details className="item-qty-details">
                    <summary className="item-qty-summary">Enter per-person quantities (for quantity-based split)</summary>
                    <div className="per-person-qty" style={{ marginTop: 8 }}>
                      {users.map(u => {
                        const uid = (u._id || u.id).toString();
                        return (
                          <div key={uid} className="ppq-row">
                            <span className="ppq-name">{u.name}</span>
                            <div className="number-stepper ppq-stepper">
                              <button type="button" className="stepper-btn"
                                onClick={() => updateItemParticipantQty(idx, uid, Math.max(0, (Number(itemParticipantQtys[idx]?.[uid]) || 0) - 1))}
                              >−</button>
                              <input
                                type="number" className="stepper-value"
                                value={itemParticipantQtys[idx]?.[uid] || 0} min="0"
                                onChange={e => updateItemParticipantQty(idx, uid, Number(e.target.value) || 0)}
                              />
                              <button type="button" className="stepper-btn"
                                onClick={() => updateItemParticipantQty(idx, uid, (Number(itemParticipantQtys[idx]?.[uid]) || 0) + 1)}
                              >+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              ))}

              {/* Multi-item split method */}
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">⚖️ Split Method</label>
                <div className="split-method-selector">
                  <button type="button" className={`sm-btn ${splitMethod === 'equal' ? 'selected' : ''}`} onClick={() => setSplitMethod('equal')}>
                    <span>⚖️</span> Equal Split
                  </button>
                  <button type="button" className={`sm-btn ${splitMethod === 'quantity' ? 'selected' : ''}`} onClick={() => setSplitMethod('quantity')}>
                    <span>📊</span> Quantity-Based
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Who Ate ──────────────────────────────────────────────────────── */}
      <div className="form-group">
        <label className="form-label">👥 Who Ate?</label>
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

      {/* ── Live Share Preview ───────────────────────────────────────────── */}
      {selectedIds.length > 0 && calcResult.total > 0 && (
        <div className="calc-preview">
          <div className="calc-header">
            <div className="calc-total">{fmt.currency(calcResult.total)}</div>
            <div className="calc-subtitle">{calcResult.breakdown}</div>
          </div>
          <div className="calc-shares">
            {users.map(u => {
              const uid   = (u._id || u.id).toString();
              const share = calcResult.shares[uid] || 0;
              const isParticipant = selectedIds.includes(uid);
              return (
                <div key={uid} className={`calc-share-row ${!isParticipant ? 'not-eating' : ''}`}>
                  <span className="user-name">{u.name}</span>
                  <span className={`amount ${share === 0 ? 'zero' : ''}`}>
                    {isParticipant ? fmt.currency(share) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
          {splitMethod === 'quantity' && pricingMethod === 'per_item' && (
            <div className="calc-method-tag">📊 Quantity-based split</div>
          )}
          {splitMethod === 'equal' && (
            <div className="calc-method-tag">⚖️ Equal split</div>
          )}
        </div>
      )}

      {/* ── Payment ──────────────────────────────────────────────────────── */}
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
            <div className="payment-total-row">
              <span>Payment Total</span>
              <span style={{ fontWeight: 700, color: Math.abs(totalPaymentEntered - calcResult.total) < 0.5 ? 'var(--green)' : 'var(--red)' }}>
                {fmt.currency(totalPaymentEntered)} / {fmt.currency(calcResult.total)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      <div className="form-group">
        <label className="form-label">📝 Notes (optional)</label>
        <textarea
          className="form-textarea"
          placeholder="e.g. Devansh absent, extra plate, special occasion..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <button
        type="submit"
        className="btn btn-primary btn-lg btn-full"
        disabled={loading || selectedIds.length === 0 || calcResult.total <= 0}
      >
        {loading ? 'Saving...' : isEdit ? '✅ Update Meal' : '✅ Save Meal'}
      </button>
    </form>
  );
}
