/** Utility helpers for the Food Expense Tracker */

export const fmt = {
  /** ₹1,234.56 */
  currency(n) {
    if (n === null || n === undefined) return '₹0.00';
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  /** ₹1.2K */
  currencyShort(n) {
    const v = Number(n || 0);
    return v >= 1000 ? '₹' + (v / 1000).toFixed(1) + 'K' : '₹' + v.toFixed(2);
  },

  /** "30 Sep 2026" */
  date(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[m - 1]} ${y}`;
  },

  /** "September 2026" */
  monthYear(year, month) {
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${months[month - 1]} ${year}`;
  },

  /** "Mon, 30 Sep" */
  dateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }
};

/** Today as YYYY-MM-DD */
export const today = () => new Date().toISOString().split('T')[0];

/** Get first day of month (0-indexed) */
export const firstDayOfMonth = (year, month) => new Date(year, month - 1, 1).getDay();

/** Days in a month */
export const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

/**
 * Distribute totalAmount among userIds with proper penny rounding.
 * Guarantees shares sum exactly equals totalAmount.
 */
export function calculateShares(totalAmount, userIds) {
  const n = userIds.length;
  if (n === 0) return {};
  const totalCents = Math.round(totalAmount * 100);
  const baseCents  = Math.floor(totalCents / n);
  const extraCents = totalCents - baseCents * n;
  const shares = {};
  userIds.forEach((uid, i) => {
    shares[uid.toString()] = (baseCents + (i < extraCents ? 1 : 0)) / 100;
  });
  return shares;
}

/** CSS class for balance amount */
export const balanceClass = (n) => {
  if (n >  0.005) return 'positive';
  if (n < -0.005) return 'negative';
  return 'zero';
};

/** User avatar CSS class (cycles 0-2) */
export const avatarClass = (index) => `avatar-${index % 3}`;

/** First letter of name */
export const initials = (name) => (name || '?').charAt(0).toUpperCase();

/** Meal icon emoji */
export const mealIcon  = (t) => t === 'breakfast' ? '🌅' : '🌙';

/** Meal label */
export const mealLabel = (t) => t === 'breakfast' ? 'Breakfast' : 'Dinner';

/** Describe who paid */
export function describePayments(payments) {
  if (!payments || payments.length === 0) return 'Not recorded';
  return payments
    .filter(p => (p.amount_paid || p.amountPaid) > 0)
    .map(p => `${p.user_name || p.userName} paid ${fmt.currency(p.amount_paid ?? p.amountPaid)}`)
    .join(', ') || 'Not recorded';
}
