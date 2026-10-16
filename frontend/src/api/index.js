import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` 
  : '/api';

const http = axios.create({
  baseURL,
  withCredentials: true // send HttpOnly cookies with every request
});

// Attach Authorization header if token exists in localStorage (dual-layer auth)
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const api = {
  // ── Authentication ─────────────────────────────────────────────
  login:             (creds) => http.post('/auth/login', creds).then(r => r.data),
  getMe:             ()      => http.get('/auth/me').then(r => r.data),
  logout:            ()      => http.post('/auth/logout').then(r => r.data),
  changeCredentials: (data)  => http.post('/auth/change-credentials', data).then(r => r.data),

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

  // ── Settlement Periods (lifecycle API) ─────────────────────────
  getPeriods:          ()       => http.get('/periods').then(r => r.data),
  getActivePeriod:     ()       => http.get('/periods/active').then(r => r.data),
  getPeriod:           (id)     => http.get(`/periods/${id}`).then(r => r.data),
  createPeriod:        (data)   => http.post('/periods', data).then(r => r.data),
  calculatePeriod:     (id)     => http.post(`/periods/${id}/calculate`).then(r => r.data),
  confirmPeriod:       (id)     => http.post(`/periods/${id}/confirm`).then(r => r.data),
  reopenPeriod:        (id, data = {}) => http.post(`/periods/${id}/reopen`, data).then(r => r.data),
  updatePeriodTx:      (periodId, txId, status) =>
    http.put(`/periods/${periodId}/transactions/${txId}`, { status }).then(r => r.data),
  deletePeriod:        (id, params = {}) => http.delete(`/periods/${id}`, { params }).then(r => r.data),

  // ── Settlements (legacy) ────────────────────────────────────────
  getSettlements:  ()      => http.get('/settlements').then(r => r.data),
  getSettlement:   (id)    => http.get(`/settlements/${id}`).then(r => r.data),
  createSettlement: (data) => http.post('/settlements', data).then(r => r.data),
  updateTransaction: (settlementId, txId, status) =>
    http.put(`/settlements/${settlementId}/transactions/${txId}`, { status }).then(r => r.data),
  deleteSettlement: (id)   => http.delete(`/settlements/${id}`).then(r => r.data),
};

export default api;
