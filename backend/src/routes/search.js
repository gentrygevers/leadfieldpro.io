const express = require('express');
const router = express.Router();
const { searchPlaces, getPlaceDetails } = require('../services/placesSearch');
const { leadsStore, searchStore } = require('../services/store');

// POST /api/search
router.post('/', async (req, res) => {
  const { city, vertical } = req.body;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!city || !vertical) {
    return res.status(400).json({ error: 'city and vertical are required' });
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });
  }

  try {
    const places = await searchPlaces(city, vertical, apiKey);

    // Get details (website/phone) for first 10 to keep it fast
    const enriched = await Promise.all(
      places.slice(0, 20).map(async (p) => {
        const details = await getPlaceDetails(p.googlePlaceId, apiKey);
        return { ...p, ...details };
      })
    );

    // Add remaining without details
    const remaining = places.slice(20).map(p => p);
    const allPlaces = [...enriched, ...remaining];

    // Save to CRM
    const saved = leadsStore.addBatch(allPlaces);

    // Record search history
    searchStore.add({ city, vertical, resultCount: saved.length });

    res.json({ leads: saved, count: saved.length });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search/history
router.get('/history', (req, res) => {
  res.json(searchStore.getAll());
});

module.exports = router;
