// Client-side localStorage store — mirrors the backend API interface.
// Used as fallback when the backend is unreachable.

const LEADS_KEY = 'lfp_leads';
const SEARCHES_KEY = 'lfp_searches';

const BENCHMARKS = {
  hvac:        { calls: 28, closeRate: 0.42, avgTicket: 485 },
  plumbing:    { calls: 22, closeRate: 0.55, avgTicket: 310 },
  electrical:  { calls: 18, closeRate: 0.48, avgTicket: 420 },
  roofing:     { calls: 12, closeRate: 0.35, avgTicket: 8500 },
  landscaping: { calls: 35, closeRate: 0.60, avgTicket: 280 },
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function calcRevenue(vertical) {
  const b = BENCHMARKS[vertical] || BENCHMARKS.hvac;
  const jobs = Math.round(b.calls * b.closeRate);
  const monthly = jobs * b.avgTicket;
  return { missedRevenue: monthly, annualRevenue: monthly * 12 };
}

function readLeads() {
  try { return JSON.parse(localStorage.getItem(LEADS_KEY) || '[]'); } catch { return []; }
}
function writeLeads(leads) {
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}
function readSearches() {
  try { return JSON.parse(localStorage.getItem(SEARCHES_KEY) || '[]'); } catch { return []; }
}

export const localStore = {
  getLeads({ status, search } = {}) {
    let leads = readLeads();
    if (status && status !== 'All') leads = leads.filter(l => l.status === status);
    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(l => l.name?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q) || l.state?.toLowerCase().includes(q));
    }
    return Promise.resolve(leads);
  },

  getStats() {
    const leads = readLeads();
    const totalMissedRevenue = leads.reduce((s, l) => s + (l.missedRevenue || 0), 0);
    const emailsFound = leads.filter(l => l.email).length;
    const emailsSent = leads.filter(l => ['Contacted','Replied','Qualified','Closed'].includes(l.status)).length;
    const statusCounts = {};
    leads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });
    return Promise.resolve({ totalLeads: leads.length, emailsFound, emailsSent, totalMissedRevenue, statusCounts });
  },

  addBatch(incoming) {
    const leads = readLeads();
    const added = incoming.map(lead => {
      const vertical = (lead.vertical || 'hvac').toLowerCase();
      const rev = calcRevenue(vertical);
      const newLead = { id: uid(), status: 'New', email: null, emailSource: null, createdAt: new Date().toISOString(), ...rev, ...lead, vertical };
      leads.push(newLead);
      return newLead;
    });
    writeLeads(leads);
    return Promise.resolve({ imported: added.length, leads: added });
  },

  updateLead(id, updates) {
    const leads = readLeads();
    const idx = leads.findIndex(l => l.id === id);
    if (idx === -1) return Promise.reject(new Error('Not found'));
    leads[idx] = { ...leads[idx], ...updates };
    writeLeads(leads);
    return Promise.resolve(leads[idx]);
  },

  deleteLead(id) {
    const leads = readLeads();
    const idx = leads.findIndex(l => l.id === id);
    if (idx === -1) return Promise.reject(new Error('Not found'));
    leads.splice(idx, 1);
    writeLeads(leads);
    return Promise.resolve({ success: true });
  },

  getSearchHistory() {
    return Promise.resolve(readSearches());
  },
};

export function isLocalMode() {
  // Returns true if we've fallen back to local storage (no backend)
  return localStorage.getItem('lfp_mode') === 'local';
}
export function setLocalMode(val) {
  localStorage.setItem('lfp_mode', val ? 'local' : 'remote');
}
