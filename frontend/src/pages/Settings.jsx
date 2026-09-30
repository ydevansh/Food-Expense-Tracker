import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import api from '../api';
import { fmt, today } from '../utils';

export default function Settings() {
  const { showToast } = useApp();
  const [settings,  setSettings]  = useState([]);
  const [current,   setCurrent]   = useState({ breakfast: 50, dinner: 70 });
  const [form,      setForm]      = useState({ meal_type: 'breakfast', price: '', effective_from: today() });
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([api.getSettings(), api.getCurrentPrices()]);
      setSettings(s);
      setCurrent(c);
    } catch { showToast('Failed to load settings', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.price || Number(form.price) <= 0) { showToast('Enter a valid price', 'error'); return; }
    setSaving(true);
    try {
      await api.updatePrice({ meal_type: form.meal_type, price: Number(form.price), effective_from: form.effective_from });
      showToast('Price updated!');
      setForm(f => ({ ...f, price: '' }));
      load();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="settings-section">
      {/* Current Prices */}
      <div>
        <div className="section-title">Current Prices</div>
        <div className="mt-8 settings-group">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">🌅 Breakfast</div>
              <div className="settings-row-sub">Per plate</div>
            </div>
            <div className="settings-row-value">{fmt.currency(current.breakfast)}</div>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">🌙 Dinner</div>
              <div className="settings-row-sub">Per plate</div>
            </div>
            <div className="settings-row-value">{fmt.currency(current.dinner)}</div>
          </div>
        </div>
      </div>

      {/* Update Price */}
      <div>
        <div className="section-title">Update Price</div>
        <div className="mt-8 card-elevated">
          <div className="info-box" style={{ marginBottom: 14 }}>
            Price changes only apply from the effective date. Old records are <strong>never</strong> changed.
          </div>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Meal Type</label>
              <div className="radio-group">
                <label className={`radio-pill ${form.meal_type === 'breakfast' ? 'selected' : ''}`}>
                  <input type="radio" value="breakfast" checked={form.meal_type === 'breakfast'} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value }))} />
                  🌅 Breakfast
                </label>
                <label className={`radio-pill ${form.meal_type === 'dinner' ? 'selected' : ''}`}>
                  <input type="radio" value="dinner" checked={form.meal_type === 'dinner'} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value }))} />
                  🌙 Dinner
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">New Price (₹ per plate)</label>
              <input type="number" className="form-input" placeholder="e.g. 60" min="1" step="0.5"
                value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Effective From</label>
              <input type="date" className="form-input" value={form.effective_from}
                onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} required />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
              {saving ? 'Saving...' : '💾 Save New Price'}
            </button>
          </form>
        </div>
      </div>

      {/* Price History */}
      <div>
        <div className="section-title">Price History</div>
        <div className="mt-8 settings-group">
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : settings.length === 0 ? (
            <div className="settings-row"><span style={{ color: 'var(--text-muted)' }}>No history</span></div>
          ) : (
            settings.map((s, i) => (
              <div key={s._id || s.id || i} className="settings-row">
                <div>
                  <div className="settings-row-label">
                    {s.mealType === 'breakfast' ? '🌅' : '🌙'}&nbsp;
                    {s.mealType.charAt(0).toUpperCase() + s.mealType.slice(1)}
                  </div>
                  <div className="settings-row-sub">From {fmt.date(s.effectiveFrom || s.effective_from)}</div>
                </div>
                <div className="settings-row-value">{fmt.currency(s.price)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Group Info */}
      <div>
        <div className="section-title">Group Members</div>
        <div className="mt-8 settings-group">
          {['Gaurav', 'Nikhil', 'Devansh'].map((name, i) => (
            <div key={name} className="settings-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={`avatar avatar-${i}`}>{name.charAt(0)}</div>
                <div className="settings-row-label">{name}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Member</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
