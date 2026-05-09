import { localStore, setLocalMode } from './localStore';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TIMEOUT_MS = 5000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    // Parse safely — Vercel 404s return HTML, not JSON
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { /* non-JSON response */ }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function withFallback(backendCall, localCall) {
  try {
    const result = await backendCall();
    setLocalMode(false);
    return result;
  } catch {
    setLocalMode(true);
    return localCall();
  }
}

export const api = {
  getLeads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return withFallback(
      () => request(`/leads${qs ? '?' + qs : ''}`),
      () => localStore.getLeads(params)
    );
  },

  updateLead: (id, updates) => withFallback(
    () => request(`/leads/${id}`, { method: 'PATCH', body: updates }),
    () => localStore.updateLead(id, updates)
  ),

  deleteLead: (id) => withFallback(
    () => request(`/leads/${id}`, { method: 'DELETE' }),
    () => localStore.deleteLead(id)
  ),

  getStats: () => withFallback(
    () => request('/leads/stats/summary'),
    () => localStore.getStats()
  ),

  searchLeads: (city, vertical) => request('/search', { method: 'POST', body: { city, vertical } }),

  getSearchHistory: () => withFallback(
    () => request('/search/history'),
    () => localStore.getSearchHistory()
  ),

  findEmail: (id) => request(`/email/find/${id}`, { method: 'POST' }),
  findEmailsBatch: (ids) => request('/email/find-batch', { method: 'POST', body: { ids } }),

  // Import always saves locally — no backend dependency
  importLeads: (leads) => localStore.addBatch(leads),

  health: () => request('/health').catch(() => ({ status: 'error' })),
};

export const STATUSES = ['New', 'Researching', 'Contacted', 'Replied', 'Qualified', 'Closed'];
export const VERTICALS = ['hvac', 'plumbing', 'electrical', 'roofing', 'landscaping'];
export const VERTICAL_LABELS = { hvac: 'HVAC', plumbing: 'Plumbing', electrical: 'Electrical', roofing: 'Roofing', landscaping: 'Landscaping' };

export function formatMoney(n) {
  if (!n && n !== 0) return '—';
  return '$' + Math.round(n).toLocaleString();
}
export function statusBadgeClass(status) { return 'badge badge-' + status.toLowerCase(); }
export function sourceTagClass(source) {
  if (!source) return 'source-tag';
  return 'source-tag source-' + source;
}
