/**
 * Utility helpers for the Food Expense Tracker frontend
 */
const Utils = {

  // ── Currency ───────────────────────────────────────────────────
  /** Format number as Indian rupees: ₹1,234.56 */
  formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₹0.00';
    return '₹' + Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  /** Short format: ₹1.2K */
  formatCurrencyShort(amount) {
    const n = Number(amount);
    if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
    return '₹' + n.toFixed(2);
  },

  // ── Dates ──────────────────────────────────────────────────────
  /** YYYY-MM-DD for a Date object (or today) */
  toDateStr(d = new Date()) {
    return d.toISOString().split('T')[0];
  },

  /** 30 Sep 2026 */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[m - 1]} ${y}`;
  },

  /** September 2026 */
  formatMonthYear(year, month) {
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${months[month - 1]} ${year}`;
  },

  /** Mon, 30 Sep */
  formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  },

  /** Today's date as YYYY-MM-DD */
  today() {
    return this.toDateStr(new Date());
  },

  /** First day of month */
  firstOfMonth(year, month) {
    return new Date(year, month - 1, 1);
  },

  /** Last day of month */
  lastOfMonth(year, month) {
    return new Date(year, month, 0);
  },

  // ── Calculation ────────────────────────────────────────────────
  /**
   * Distribute totalAmount among userIds with proper penny rounding.
   * Returns { [userId]: shareAmount }
   */
  calculateShares(totalAmount, userIds) {
    const n = userIds.length;
    if (n === 0) return {};
    const totalCents = Math.round(totalAmount * 100);
    const baseCents  = Math.floor(totalCents / n);
    const extraCents = totalCents - baseCents * n;
    const shares = {};
    userIds.forEach((uid, i) => {
      shares[uid] = (baseCents + (i < extraCents ? 1 : 0)) / 100;
    });
    return shares;
  },

  // ── Meal helpers ───────────────────────────────────────────────
  mealIcon(mealType) {
    return mealType === 'breakfast' ? '🌅' : '🌙';
  },

  mealLabel(mealType) {
    return mealType === 'breakfast' ? 'Breakfast' : 'Dinner';
  },

  // ── User helpers ───────────────────────────────────────────────
  userInitials(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
  },

  userAvatarClass(index) {
    return `avatar-${index % 3}`;
  },

  // ── Balance helpers ────────────────────────────────────────────
  balanceClass(amount) {
    if (amount > 0.005)  return 'positive';
    if (amount < -0.005) return 'negative';
    return 'zero';
  },

  balanceLabel(amount) {
    if (amount > 0.005)  return 'to receive';
    if (amount < -0.005) return 'to pay';
    return 'balanced';
  },

  // ── HTML helpers ───────────────────────────────────────────────
  /** Escape HTML special chars */
  escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  // ── Status helpers ─────────────────────────────────────────────
  statusBadge(status) {
    const labels = { pending: 'Pending', paid: 'Paid', settled: 'Settled', partial: 'Partial' };
    return `<span class="status-badge ${status}">${labels[status] || status}</span>`;
  },

  // ── Payment description ────────────────────────────────────────
  describePayments(payments, users) {
    if (!payments || payments.length === 0) return 'Not recorded';
    return payments
      .filter(p => p.amount_paid > 0)
      .map(p => `${p.user_name} paid ${Utils.formatCurrency(p.amount_paid)}`)
      .join(', ');
  },

  // ── Render meal card ───────────────────────────────────────────
  renderMealCard(meal, users, options = {}) {
    const { showActions = true, showDate = false } = options;
    const plates = meal.number_of_plates;
    const total  = meal.total_amount;
    const ppp    = meal.price_per_plate;

    // Build share rows for all users
    const shareMap = {};
    meal.participants.forEach(p => { shareMap[p.user_id] = p.share_amount; });

    const shareRows = users.map((u, i) => {
      const share = shareMap[u.id] || 0;
      return `<div class="share-row">
        <span class="name">${Utils.escHtml(u.name)}</span>
        <span class="share ${share === 0 ? 'zero' : ''}">${Utils.formatCurrency(share)}</span>
      </div>`;
    }).join('');

    // Participant chips
    const participantChips = meal.participants.map(p =>
      `<span class="participant-chip">${Utils.escHtml(p.user_name)}</span>`
    ).join('');

    // Payment info
    const payInfo = Utils.describePayments(meal.payments);

    const actionsHtml = showActions ? `
      <div class="meal-actions">
        <button class="btn btn-sm btn-secondary flex-1" onclick="App.editMeal(${meal.id})">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" onclick="App.confirmDeleteMeal(${meal.id})">🗑️</button>
      </div>` : '';

    const dateHtml = showDate ? `<div class="text-sm text-muted" style="margin-bottom:4px">${Utils.formatDate(meal.date)}</div>` : '';

    return `
      <div class="meal-card" id="meal-${meal.id}">
        ${dateHtml}
        <div class="meal-card-header">
          <span class="meal-type-badge ${meal.meal_type}">
            ${Utils.mealIcon(meal.meal_type)} ${Utils.mealLabel(meal.meal_type)}
          </span>
          <span class="meal-amount">${Utils.formatCurrency(total)}</span>
        </div>
        <div class="meal-card-body">
          <div class="meal-meta">${plates} plate${plates > 1 ? 's' : ''} × ${Utils.formatCurrency(ppp)} = ${Utils.formatCurrency(total)}</div>
          <div class="meal-participants">${participantChips}</div>
          <div class="meal-shares">${shareRows}</div>
          <div class="meal-divider"></div>
          <div class="paid-by">💳 ${payInfo}</div>
          ${meal.notes ? `<div class="text-sm text-muted mt-8">📝 ${Utils.escHtml(meal.notes)}</div>` : ''}
        </div>
        ${actionsHtml}
      </div>`;
  },

  // ── Show toast ─────────────────────────────────────────────────
  showToast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.classList.remove('show'); }, 3000);
  }
};
