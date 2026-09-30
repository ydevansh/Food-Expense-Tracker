import React from 'react';
import { fmt, mealIcon, mealLabel, describePayments, avatarClass, initials } from '../utils';

/**
 * MealCard — displays a single meal record with share breakdown.
 * Props: meal, users, onEdit, onDelete, showDate
 */
export default function MealCard({ meal, users = [], onEdit, onDelete, showDate = false }) {
  const plates = meal.number_of_plates ?? meal.numberOfPlates;
  const total  = meal.total_amount     ?? meal.totalAmount;
  const ppp    = meal.price_per_plate  ?? meal.pricePerPlate;
  const mType  = meal.meal_type        ?? meal.mealType;

  // Build share map
  const shareMap = {};
  (meal.participants || []).forEach(p => {
    const uid = (p.user_id || p.userId || '').toString();
    shareMap[uid] = p.share_amount ?? p.shareAmount ?? 0;
  });

  return (
    <div className="meal-card">
      {showDate && (
        <div style={{ padding: '10px 16px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
          {fmt.dateShort(meal.date)}
        </div>
      )}

      {/* Header */}
      <div className="meal-card-header">
        <span className={`meal-type-badge ${mType}`}>
          {mealIcon(mType)} {mealLabel(mType)}
        </span>
        <span className="meal-amount">{fmt.currency(total)}</span>
      </div>

      {/* Body */}
      <div className="meal-card-body">
        <div className="meal-meta">
          {plates} plate{plates !== 1 ? 's' : ''} × {fmt.currency(ppp)} = {fmt.currency(total)}
        </div>

        {/* Participant chips */}
        <div className="meal-participants">
          {(meal.participants || []).map(p => (
            <span key={p.user_id || p.userId} className="participant-chip">
              {p.user_name || p.userName}
            </span>
          ))}
        </div>

        {/* Share breakdown — all users */}
        <div className="meal-shares">
          {users.map((u, i) => {
            const share = shareMap[u._id?.toString() || u.id?.toString()] || 0;
            return (
              <div key={u._id || u.id} className="share-row">
                <span className="name">
                  <span className={`avatar ${avatarClass(i)}`} style={{ width: 20, height: 20, fontSize: 9 }}>
                    {initials(u.name)}
                  </span>
                  &nbsp;{u.name}
                </span>
                <span className={`share ${share === 0 ? 'zero' : ''}`}>{fmt.currency(share)}</span>
              </div>
            );
          })}
        </div>

        <div className="meal-divider" />
        <div className="paid-by">💳 {describePayments(meal.payments)}</div>
        {meal.notes && (
          <div className="text-sm text-muted" style={{ marginTop: 6 }}>📝 {meal.notes}</div>
        )}
      </div>

      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="meal-actions">
          {onEdit && (
            <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => onEdit(meal)}>
              ✏️ Edit
            </button>
          )}
          {onDelete && (
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(meal)}>🗑️</button>
          )}
        </div>
      )}
    </div>
  );
}
