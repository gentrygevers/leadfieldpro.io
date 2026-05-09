const axios = require('axios');

const VERTICAL_KEYWORDS = {
  hvac: 'HVAC air conditioning heating',
  plumbing: 'plumber plumbing',
  electrical: 'electrician electrical',
  roofing: 'roofing roofer',
  landscaping: 'landscaping lawn care'
};

// Google Places Text Search
async function searchPlaces(city, vertical, apiKey) {
  const keyword = VERTICAL_KEYWORDS[vertical] || vertical;
  const query = encodeURIComponent(`${keyword} in ${city}`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;

  let results = [];
  let nextPageToken = null;

  // Fetch up to 3 pages (60 results)
  for (let page = 0; page < 3; page++) {
    let pageUrl = url;
    if (nextPageToken) {
      await new Promise(r => setTimeout(r, 2000)); // required delay for next_page_token
      pageUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${apiKey}`;
    }
    try {
      const res = await axios.get(pageUrl, { timeout: 10000 });
      const data = res.data;
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API error: ${data.status} - ${data.error_message || ''}`);
      }
      results = results.concat(data.results || []);
      nextPageToken = data.next_page_token || null;
      if (!nextPageToken) break;
    } catch (err) {
      throw err;
    }
  }

  // Filter: remove large chains (>800 reviews), format results
  return results
    .filter(p => !p.user_ratings_total || p.user_ratings_total <= 800)
    .map(p => ({
      googlePlaceId: p.place_id,
      name: p.name,
      address: p.formatted_address || '',
      city,
      vertical,
      rating: p.rating || null,
      reviewCount: p.user_ratings_total || 0,
      website: null,
      phone: null,
      types: p.types || []
    }));
}

// Get place details (website, phone)
async function getPlaceDetails(placeId, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number&key=${apiKey}`;
  try {
    const res = await axios.get(url, { timeout: 8000 });
    const result = res.data.result || {};
    return {
      website: result.website || null,
      phone: result.formatted_phone_number || null
    };
  } catch {
    return { website: null, phone: null };
  }
}

module.exports = { searchPlaces, getPlaceDetails };
