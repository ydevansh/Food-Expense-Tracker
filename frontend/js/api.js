/**
 * API Service — all calls to the Food Expense Tracker backend
 */
const API_BASE = 'http://localhost:3001/api';

const API = {
  async _req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(API_BASE + path, opts);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'API error');
    return data;
  },

  get:    (path)        => API._req('GET',    path),
  post:   (path, body)  => API._req('POST',   path, body),
  put:    (path, body)  => API._req('PUT',    path, body),
  delete: (path)        => API._req('DELETE', path),

  // ── Users ─────────────────────────────────────────────────────
  getUsers() { return this.get('/users'); },

  // ── Settings ──────────────────────────────────────────────────
  getSettings()                    { return this.get('/settings'); },
  getCurrentPrices(date)           { return this.get('/settings/current' + (date ? `?date=${date}` : '')); },
  updatePrice(meal_type, price, effective_from) {
    return this.post('/settings', { meal_type, price, effective_from });
  },

  // ── Meals ─────────────────────────────────────────────────────
  getMeals(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const q = params.toString();
    return this.get('/meals' + (q ? '?' + q : ''));
  },
  getMeal(id)       { return this.get(`/meals/${id}`); },
  createMeal(data)  { return this.post('/meals', data); },
  updateMeal(id, data) { return this.put(`/meals/${id}`, data); },
  deleteMeal(id)    { return this.delete(`/meals/${id}`); },

  // ── Dashboard ─────────────────────────────────────────────────
  getDashboard() { return this.get('/dashboard'); },

  // ── Daily ─────────────────────────────────────────────────────
  getDaily(date) { return this.get(`/daily/${date}`); },

  // ── Calendar ──────────────────────────────────────────────────
  getCalendar(year, month) { return this.get(`/calendar/${year}/${month}`); },

  // ── Balances ──────────────────────────────────────────────────
  getBalances(start_date, end_date) {
    const params = new URLSearchParams();
    if (start_date) params.set('start_date', start_date);
    if (end_date)   params.set('end_date',   end_date);
    const q = params.toString();
    return this.get('/balances' + (q ? '?' + q : ''));
  },

  // ── Reports ───────────────────────────────────────────────────
  getReports(start_date, end_date) {
    const params = new URLSearchParams();
    if (start_date) params.set('start_date', start_date);
    if (end_date)   params.set('end_date',   end_date);
    return this.get('/reports?' + params.toString());
  },

  // ── Settlements ───────────────────────────────────────────────
  getSettlements()               { return this.get('/settlements'); },
  getSettlement(id)              { return this.get(`/settlements/${id}`); },
  createSettlement(start_date, end_date) { return this.post('/settlements', { start_date, end_date }); },
  updateTransaction(settlementId, txId, status) {
    return this.put(`/settlements/${settlementId}/transactions/${txId}`, { status });
  },
  deleteSettlement(id) { return this.delete(`/settlements/${id}`); },
};
