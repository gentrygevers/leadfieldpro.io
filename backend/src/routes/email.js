const express = require('express');
const router = express.Router();
const { findEmail } = require('../services/emailFinder');
const { leadsStore } = require('../services/store');

// POST /api/email/find/:id — find email for a single lead
router.post('/find/:id', async (req, res) => {
  const lead = leadsStore.getById(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  try {
    const result = await findEmail(lead.name, lead.website, lead.city);
    const updated = leadsStore.update(lead.id, {
      email: result.email,
      emailSource: result.source,
      status: lead.status === 'New' ? 'Researching' : lead.status
    });
    res.json({ email: result.email, source: result.source, lead: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email/find-batch — find emails for multiple leads
router.post('/find-batch', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const results = [];
  for (const id of ids) {
    const lead = leadsStore.getById(id);
    if (!lead) { results.push({ id, error: 'not found' }); continue; }
    try {
      const result = await findEmail(lead.name, lead.website, lead.city);
      const updated = leadsStore.update(id, {
        email: result.email,
        emailSource: result.source,
        status: lead.status === 'New' ? 'Researching' : lead.status
      });
      results.push({ id, email: result.email, source: result.source, lead: updated });
    } catch (err) {
      results.push({ id, error: err.message });
    }
  }

  res.json({ results });
});

module.exports = router;
