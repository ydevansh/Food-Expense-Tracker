/** Dashboard Page */
const DashboardPage = {
  async render() {
    try {
      const data = await API.getDashboard();
      const { today, today_date, month_stats: ms, user_balances: ub } = data;
      const users = await API.getUsers();

      const todayFormatted = Utils.formatDate(today_date);
      const todayMealsHtml = today.length === 0
        ? `<div class="empty-state">
            <div class="empty-icon">🍽️</div>
            <h3>No meals recorded today</h3>
            <p>Tap the <strong>+</strong> button to add today's breakfast or dinner</p>
          </div>`
        : today.map(meal => Utils.renderMealCard(meal, users)).join('');

      // Balance cards
      const balanceCardsHtml = ub.map((b, i) => `
        <div class="balance-card">
          <div class="balance-name">${Utils.escHtml(b.user.name)}</div>
          <div class="balance-amount ${Utils.balanceClass(b.balance)}">
            ${b.balance >= 0 ? '+' : ''}${Utils.formatCurrency(b.balance)}
          </div>
          <div class="balance-label">${Utils.balanceLabel(b.balance)}</div>
        </div>`).join('');

      return `
        <div class="page-section">
          <!-- Hero gradient card -->
          <div class="card-gradient">
            <div style="font-size:12px;font-weight:700;opacity:0.8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Today</div>
            <div style="font-size:22px;font-weight:800;margin-bottom:2px">${todayFormatted}</div>
            <div style="font-size:28px;font-weight:900;line-height:1">${Utils.formatCurrency(ms.total_expense)}</div>
            <div style="font-size:13px;opacity:0.8;margin-top:4px">This month • ${ms.days_with_meals} days • ${ms.total_plates} plates</div>
          </div>

          <!-- Quick Stats -->
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-label">🌅 Breakfast</div>
              <div class="stat-value orange">${Utils.formatCurrencyShort(ms.breakfast_expense)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">🌙 Dinner</div>
              <div class="stat-value orange">${Utils.formatCurrencyShort(ms.dinner_expense)}</div>
            </div>
          </div>

          <!-- Balances -->
          <div>
            <div class="section-title">Monthly Balances</div>
            <div class="mt-8"></div>
            <div class="balance-grid">${balanceCardsHtml}</div>
            <div class="info-box mt-8">
              <strong>+</strong> means paid more → will receive at settlement<br>
              <strong>−</strong> means paid less → will pay at settlement
            </div>
          </div>

          <!-- Today's Meals -->
          <div>
            <div class="section-title">Today's Meals</div>
            <div class="mt-8" style="display:flex;flex-direction:column;gap:10px">${todayMealsHtml}</div>
          </div>

          <!-- More Actions -->
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary flex-1" onclick="App.navigate('reports')">📊 Reports</button>
            <button class="btn btn-secondary flex-1" onclick="App.navigate('settlement')">💰 Settle Up</button>
          </div>
        </div>`;
    } catch (err) {
      return `<div class="page-section"><div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Connection Error</h3>
        <p>${Utils.escHtml(err.message)}</p>
        <button class="btn btn-primary mt-8" onclick="App.navigate('dashboard')">Retry</button>
      </div></div>`;
    }
  }
};
