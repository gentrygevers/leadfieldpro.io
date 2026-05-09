const express = require('express');
const router = express.Router();
const { leadsStore } = require('../services/store');

// GET /api/leads
router.get('/', (req, res) => {
  let leads = leadsStore.getAll();
  const { status, search } = req.query;
  if (status && status !== 'All') leads = leads.filter(l => l.status === status);
  if (search) {
    const q = search.toLowerCase();
    leads = leads.filter(l =>
      l.name?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q)
    );
  }
  res.json(leads);
});

// GET /api/leads/stats/summary — must be before /:id
router.get('/stats/summary', (req, res) => {
  const leads = leadsStore.getAll();
  const totalMissedRevenue = leads.reduce((sum, l) => sum + (l.missedRevenue || 0), 0);
  const emailsFound = leads.filter(l => l.email).length;
  const emailsSent = leads.filter(l => ['Contacted', 'Replied', 'Qualified', 'Closed'].includes(l.status)).length;
  const statusCounts = {};
  leads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });
  res.json({ totalLeads: leads.length, emailsFound, emailsSent, totalMissedRevenue, statusCounts });
});

// POST /api/leads/import — bulk import from CSV
router.post('/import', (req, res) => {
  const { leads } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'leads array is required' });
  }
  if (leads.length > 500) {
    return res.status(400).json({ error: 'Max 500 leads per import' });
  }
  const saved = leadsStore.addBatch(leads);
  res.json({ imported: saved.length, leads: saved });
});

// GET /api/leads/:id
router.get('/:id', (req, res) => {
  const lead = leadsStore.getById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});

// PATCH /api/leads/:id
router.patch('/:id', (req, res) => {
  const updated = leadsStore.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

// DELETE /api/leads/:id
router.delete('/:id', (req, res) => {
  const deleted = leadsStore.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

module.exports = router;
