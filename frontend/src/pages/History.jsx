import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import api from '../api';
import MealCard from '../components/MealCard';
import { fmt } from '../utils';

const USERS_FILTER = [{ value: '', label: 'All People' }];

export default function History() {
  const { users, showToast, showModal, closeModal } = useApp();
  const navigate = useNavigate();

  const [meals,   setMeals]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    meal_type:  '',
    user_id:    '',
    paid_by:    '',
    start_date: '',
    end_date:   ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const data  = await api.getMeals(clean);
      setMeals(data);
    } catch (err) {
      showToast('Failed to load meals', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleEdit   = (meal) => navigate(`/add/${meal._id || meal.id}`);
  const handleDelete = (meal) => {
    showModal({
      title: 'Delete Meal',
      body: (
        <p style={{ color: 'var(--text-secondary)' }}>
          Delete {meal.meal_type} on {fmt.date(meal.date)}? This cannot be undone.
        </p>
      ),
      footer: (
        <>
          <button className="btn btn-secondary flex-1" onClick={closeModal}>Cancel</button>
          <button className="btn btn-danger flex-1" onClick={async () => {
            try {
              await api.deleteMeal(meal._id || meal.id);
              showToast('Deleted!');
              closeModal();
              load();
            } catch { showToast('Delete failed', 'error'); }
          }}>Delete</button>
        </>
      )
    });
  };

  const clearFilters = () => setFilters({ meal_type: '', user_id: '', paid_by: '', start_date: '', end_date: '' });
  const activeFilters = Object.values(filters).filter(Boolean).length;

  // Group meals by date
  const grouped = meals.reduce((acc, m) => {
    const d = m.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(m);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      {/* Filter Bar */}
      <div className="filter-bar">
        <button
          className={`filter-chip ${activeFilters > 0 ? 'active' : ''}`}
          onClick={() => setShowFilters(f => !f)}
        >
          🔍 Filters {activeFilters > 0 ? `(${activeFilters})` : ''}
        </button>
        <button className={`filter-chip ${filters.meal_type === 'breakfast' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, meal_type: f.meal_type === 'breakfast' ? '' : 'breakfast' }))}>🌅 Breakfast</button>
        <button className={`filter-chip ${filters.meal_type === 'dinner' ? 'active' : ''}`}    onClick={() => setFilters(f => ({ ...f, meal_type: f.meal_type === 'dinner'    ? '' : 'dinner'    }))}>🌙 Dinner</button>
        {users.map(u => (
          <button
            key={u._id || u.id}
            className={`filter-chip ${filters.user_id === (u._id || u.id) ? 'active' : ''}`}
            onClick={() => setFilters(f => ({ ...f, user_id: f.user_id === (u._id||u.id) ? '' : (u._id||u.id) }))}
          >
            {u.name}
          </button>
        ))}
        {activeFilters > 0 && (
          <button className="filter-chip" onClick={clearFilters}>✕ Clear</button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="form-group">
              <label className="form-label">From</label>
              <input type="date" className="form-input" value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input type="date" className="form-input" value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Paid By</label>
            <select className="form-select" value={filters.paid_by} onChange={e => setFilters(f => ({ ...f, paid_by: e.target.value }))}>
              <option value="">All</option>
              {users.map(u => <option key={u._id||u.id} value={u._id||u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Meals List */}
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading ? (
          <div className="page-loader"><div className="loader-spinner" /></div>
        ) : sortedDates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No meals found</h3>
            <p>Try changing your filters or add some meals</p>
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date}>
              <div className="date-group-header">
                <div className="date-group-line" />
                <div className="date-group-label">{fmt.date(date)}</div>
                <div className="date-group-line" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grouped[date].map(meal => (
                  <MealCard
                    key={meal._id || meal.id}
                    meal={meal}
                    users={users}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
