import React from 'react';
import { fmt, mealIcon, mealLabel, describePayments, avatarClass, initials } from '../utils';

// Human-readable labels for pricing methods
const PRICING_METHOD_LABELS = {
  per_plate: 'Per Plate',
  per_item:  'Per Item',
  manual:    'Manual Total'
};

const SPLIT_METHOD_LABELS = {
  equal:    '⚖️ Equal split',
  quantity: '📊 Quantity-based split'
};

/**
 * MealCard — displays a single meal record with share breakdown.
 * Props: meal, users, onEdit, onDelete, showDate
 */
export default function MealCard({ meal, users = [], onEdit, onDelete, showDate = false }) {
  const plates  = meal.number_of_plates ?? meal.numberOfPlates;
  const total   = meal.total_amount     ?? meal.totalAmount;
  const ppp     = meal.price_per_plate  ?? meal.pricePerPlate;
  const mType   = meal.meal_type        ?? meal.mealType;
  const fType   = meal.food_type        ?? meal.foodType  ?? 'regular';
  const pm      = meal.pricing_method   ?? meal.pricingMethod;
  const sm      = meal.split_method     ?? meal.splitMethod ?? 'equal';
  const desc    = meal.description;
  const mItems  = meal.items || [];
  const isCustom = fType === 'custom';

  // Build share map
  const shareMap = {};
  (meal.participants || []).forEach(p => {
    const uid = (p.user_id || p.userId || '').toString();
    shareMap[uid] = p.share_amount ?? p.shareAmount ?? 0;
  });

  // Build quantity map (for per-item meals)
  const qtyMap = {};
  (meal.participants || []).forEach(p => {
    const uid = (p.user_id || p.userId || '').toString();
    qtyMap[uid] = p.quantity ?? 0;
  });

  return (
    <div className={`meal-card ${isCustom ? 'meal-card-custom' : ''}`}>
      {showDate && (
        <div style={{ padding: '10px 16px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
          {fmt.dateShort(meal.date)}
        </div>
      )}

      {/* Header */}
      <div className="meal-card-header">
        <div className="meal-header-left">
          <span className={`meal-type-badge ${mType}`}>
            {mealIcon(mType)} {mealLabel(mType)}
          </span>
          {isCustom && (
            <span className="custom-meal-badge">✨ Custom</span>
          )}
          {meal.custom_price && !isCustom && (
            <span className="custom-price-badge">✏️ Custom Price</span>
          )}
        </div>
        <span className="meal-amount">{fmt.currency(total)}</span>
      </div>

      {/* Body */}
      <div className="meal-card-body">

        {/* Description / Food label */}
        {desc && (
          <div className="meal-description">📋 {desc}</div>
        )}

        {/* Pricing summary */}
        <div className="meal-meta">
          {isCustom ? (
            <>
              {pm && <span className="meal-pm-tag">{PRICING_METHOD_LABELS[pm] || pm}</span>}
              {/* Multi-item breakdown */}
              {mItems.length > 1 ? (
                <div className="meal-items-list">
                  {mItems.map((it, i) => (
                    <div key={i} className="meal-item-row">
                      <span className="mi-desc">{it.description || `Item ${i+1}`}</span>
                      <span className="mi-calc">
                        {it.quantity} {it.unit}{it.quantity !== 1 ? 's' : ''} × {fmt.currency(it.unitPrice)} = {fmt.currency(it.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : mItems.length === 1 ? (
                <span>
                  {pm === 'manual'
                    ? `Manual total: ${fmt.currency(total)}`
                    : `${mItems[0].quantity} ${mItems[0].unit}${mItems[0].quantity !== 1 ? 's' : ''} × ${fmt.currency(mItems[0].unitPrice)}`
                  }
                </span>
              ) : (
                <span>{fmt.currency(total)}</span>
              )}
            </>
          ) : (
            <span>
              {plates} plate{plates !== 1 ? 's' : ''} × {fmt.currency(ppp)} = {fmt.currency(total)}
            </span>
          )}
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
            const uid   = u._id?.toString() || u.id?.toString();
            const share = shareMap[uid] || 0;
            const qty   = qtyMap[uid]   || 0;
            const isParticipant = (meal.participants || []).some(
              p => (p.user_id || p.userId).toString() === uid
            );
            return (
              <div key={uid} className={`share-row ${!isParticipant ? 'share-row-absent' : ''}`}>
                <span className="name">
                  <span className={`avatar ${avatarClass(i)}`} style={{ width: 20, height: 20, fontSize: 9 }}>
                    {initials(u.name)}
                  </span>
                  &nbsp;{u.name}
                  {/* Show qty for per-item meals */}
                  {isCustom && sm === 'quantity' && isParticipant && qty > 0 && (
                    <span className="share-qty">({qty}×)</span>
                  )}
                </span>
                <span className={`share ${share === 0 ? 'zero' : ''}`}>
                  {isParticipant ? fmt.currency(share) : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Split method tag for custom meals */}
        {isCustom && sm && (
          <div className="split-method-tag">{SPLIT_METHOD_LABELS[sm] || sm}</div>
        )}

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
