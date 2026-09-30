import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

const api = {
  // ── Users ──────────────────────────────────────────────────────
  getUsers: ()             => http.get('/users').then(r => r.data),

  // ── Settings ───────────────────────────────────────────────────
  getSettings: ()          => http.get('/settings').then(r => r.data),
  getCurrentPrices: (date) => http.get(`/settings/current${date ? `?date=${date}` : ''}`).then(r => r.data),
  updatePrice: (data)      => http.post('/settings', data).then(r => r.data),

  // ── Meals ──────────────────────────────────────────────────────
  getMeals: (params = {})  => http.get('/meals', { params }).then(r => r.data),
  getMeal:  (id)           => http.get(`/meals/${id}`).then(r => r.data),
  createMeal: (data)       => http.post('/meals', data).then(r => r.data),
  updateMeal: (id, data)   => http.put(`/meals/${id}`, data).then(r => r.data),
  deleteMeal: (id)         => http.delete(`/meals/${id}`).then(r => r.data),

  // ── Dashboard ──────────────────────────────────────────────────
  getDashboard: ()         => http.get('/dashboard').then(r => r.data),

  // ── Daily ──────────────────────────────────────────────────────
  getDaily: (date)         => http.get(`/daily/${date}`).then(r => r.data),

  // ── Calendar ───────────────────────────────────────────────────
  getCalendar: (year, mon) => http.get(`/calendar/${year}/${mon}`).then(r => r.data),

  // ── Reports ────────────────────────────────────────────────────
  getReports: (params)     => http.get('/reports', { params }).then(r => r.data),

  // ── Settlements ────────────────────────────────────────────────
  getSettlements:  ()      => http.get('/settlements').then(r => r.data),
  getSettlement:   (id)    => http.get(`/settlements/${id}`).then(r => r.data),
  createSettlement: (data) => http.post('/settlements', data).then(r => r.data),
  updateTransaction: (settlementId, txId, status) =>
    http.put(`/settlements/${settlementId}/transactions/${txId}`, { status }).then(r => r.data),
  deleteSettlement: (id)   => http.delete(`/settlements/${id}`).then(r => r.data),
};

export default api;
