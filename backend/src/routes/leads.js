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
  const today = new Date().toISOString().slice(0, 10);
  const totalMissedRevenue = leads.reduce((sum, l) => sum + (l.missedRevenue || 0), 0);
  const emailsFound = leads.filter(l => l.email).length;
  const emailsSent = leads.filter(l => ['Contacted', 'Replied', 'Qualified', 'Closed'].includes(l.status)).length;
  const followUpsDue = leads.filter(l => l.followUpDate && l.followUpDate <= today && (l.followUpStage || 0) < 4 && l.status !== 'Closed').length;
  const statusCounts = {};
  leads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });
  res.json({ totalLeads: leads.length, emailsFound, emailsSent, totalMissedRevenue, followUpsDue, statusCounts });
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

// POST /api/leads/:id/refresh-reviews
router.post('/:id/refresh-reviews', async (req, res) => {
  const lead = leadsStore.getById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'No Google Places API key configured' });

  try {
    // Search for the place
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(lead.name + ' ' + (lead.city || ''))}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const place = searchData.results?.[0];
    if (!place) return res.status(404).json({ error: 'Place not found on Google' });

    // Get place details
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=rating,user_ratings_total&key=${apiKey}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();
    const details = detailData.result || {};

    const updates = {
      rating: details.rating ?? lead.rating,
      reviewCount: details.user_ratings_total ?? lead.reviewCount,
    };
    const updated = leadsStore.update(req.params.id, updates);
    res.json({ rating: updated.rating, reviewCount: updated.reviewCount, lead: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from Google Places: ' + err.message });
  }
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
