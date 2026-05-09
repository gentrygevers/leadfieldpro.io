const { v4: uuidv4 } = require('uuid');

const store = {
  leads: [],
  searches: []
};

const INDUSTRY_BENCHMARKS = {
  hvac: { calls: 28, closeRate: 0.42, avgTicket: 485, answerRate: 0.78, label: 'HVAC' },
  plumbing: { calls: 22, closeRate: 0.55, avgTicket: 310, answerRate: 0.80, label: 'Plumbing' },
  electrical: { calls: 18, closeRate: 0.48, avgTicket: 420, answerRate: 0.75, label: 'Electrical' },
  roofing: { calls: 12, closeRate: 0.35, avgTicket: 8500, answerRate: 0.70, label: 'Roofing' },
  landscaping: { calls: 35, closeRate: 0.60, avgTicket: 280, answerRate: 0.82, label: 'Landscaping' }
};

function calcMissedRevenue(vertical) {
  const b = INDUSTRY_BENCHMARKS[vertical] || INDUSTRY_BENCHMARKS.hvac;
  const missedCalls = Math.round(b.calls * (1 - b.answerRate));
  const missedLeads = Math.round(missedCalls * b.closeRate);
  const monthly = missedLeads * b.avgTicket;
  return { monthly, annual: monthly * 12, missedCalls, missedLeads };
}

const leadsStore = {
  getAll() { return store.leads; },
  getById(id) { return store.leads.find(l => l.id === id); },
  add(lead) {
    const vertical = (lead.vertical || 'hvac').toLowerCase();
    const revenue = calcMissedRevenue(vertical);
    const newLead = {
      id: uuidv4(),
      status: 'New',
      email: null,
      emailSource: null,
      createdAt: new Date().toISOString(),
      missedRevenue: revenue.monthly,
      annualRevenue: revenue.annual,
      missedCalls: revenue.missedCalls,
      missedLeads: revenue.missedLeads,
      ...lead,
      vertical
    };
    store.leads.push(newLead);
    return newLead;
  },
  addBatch(leads) { return leads.map(l => leadsStore.add(l)); },
  update(id, updates) {
    const idx = store.leads.findIndex(l => l.id === id);
    if (idx === -1) return null;
    store.leads[idx] = { ...store.leads[idx], ...updates };
    return store.leads[idx];
  },
  delete(id) {
    const idx = store.leads.findIndex(l => l.id === id);
    if (idx === -1) return false;
    store.leads.splice(idx, 1);
    return true;
  }
};

const searchStore = {
  getAll() { return store.searches; },
  add(search) {
    const entry = { id: uuidv4(), timestamp: new Date().toISOString(), ...search };
    store.searches.unshift(entry);
    if (store.searches.length > 20) store.searches.pop();
    return entry;
  }
};

module.exports = { leadsStore, searchStore, INDUSTRY_BENCHMARKS, calcMissedRevenue };
