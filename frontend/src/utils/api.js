const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  // Leads
  getLeads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/leads${qs ? '?' + qs : ''}`);
  },
  updateLead: (id, updates) => request(`/leads/${id}`, { method: 'PATCH', body: updates }),
  deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),
  getStats: () => request('/leads/stats/summary'),

  // Search
  searchLeads: (city, vertical) => request('/search', { method: 'POST', body: { city, vertical } }),
  getSearchHistory: () => request('/search/history'),

  // Email
  findEmail: (id) => request(`/email/find/${id}`, { method: 'POST' }),
  findEmailsBatch: (ids) => request('/email/find-batch', { method: 'POST', body: { ids } }),

  // Health
  health: () => request('/health').catch(() => ({ status: 'error' }))
};

export const STATUSES = ['New', 'Researching', 'Contacted', 'Replied', 'Qualified', 'Closed'];
export const VERTICALS = ['hvac', 'plumbing', 'electrical', 'roofing', 'landscaping'];
export const VERTICAL_LABELS = { hvac: 'HVAC', plumbing: 'Plumbing', electrical: 'Electrical', roofing: 'Roofing', landscaping: 'Landscaping' };

export function formatMoney(n) {
  if (!n && n !== 0) return '—';
  return '$' + Math.round(n).toLocaleString();
}

export function statusBadgeClass(status) {
  return 'badge badge-' + status.toLowerCase();
}

export function sourceTagClass(source) {
  if (!source) return 'source-tag';
  return 'source-tag source-' + source;
}
