const axios = require('axios');
const cheerio = require('cheerio');

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const SKIP_DOMAINS = ['sentry.io', 'wixpress.com', 'example.com', 'yourdomain', 'email.com',
  'domain.com', 'placeholder', 'wordpress.com', 'squarespace.com', 'wix.com', 'godaddy.com'];

const CONTACT_PATHS = ['', '/contact', '/contact-us', '/about', '/about-us', '/contact.html', '/about.html'];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

function cleanEmails(emails, domain) {
  return [...new Set(emails)].filter(email => {
    if (!email.includes('@')) return false;
    const parts = email.split('@');
    if (parts[0].length < 2 || parts[1].length < 4) return false;
    if (SKIP_DOMAINS.some(d => email.toLowerCase().includes(d))) return false;
    if (email.includes('..') || email.startsWith('.')) return false;
    const ext = parts[1].split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'css', 'js'].includes(ext)) return false;
    return true;
  });
}

async function fetchPage(url, timeout = 6000) {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout, maxRedirects: 3 });
    return res.data;
  } catch {
    return null;
  }
}

function extractEmails(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  $('script,style,noscript').remove();
  const text = $.html();
  const matches = text.match(EMAIL_REGEX) || [];
  // also check mailto hrefs
  const mailtoes = [];
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
    if (href) mailtoes.push(href);
  });
  return [...matches, ...mailtoes];
}

async function scrapeWebsite(websiteUrl) {
  if (!websiteUrl) return null;
  let base = websiteUrl.replace(/\/$/, '');
  if (!base.startsWith('http')) base = 'https://' + base;

  const domain = new URL(base).hostname;

  for (const path of CONTACT_PATHS) {
    const html = await fetchPage(base + path);
    if (!html) continue;
    const emails = cleanEmails(extractEmails(html), domain);
    if (emails.length) {
      // Prefer business emails (not gmail/yahoo etc)
      const biz = emails.find(e => !e.match(/@(gmail|yahoo|hotmail|outlook|icloud|aol)\./i));
      return { email: biz || emails[0], source: 'website' };
    }
  }
  return null;
}

async function scrapeFacebook(businessName, city) {
  try {
    const query = encodeURIComponent(`site:facebook.com "${businessName}" "${city}"`);
    const searchUrl = `https://www.google.com/search?q=${query}`;
    const html = await fetchPage(searchUrl, 8000);
    if (!html) return null;

    const $ = cheerio.load(html);
    let fbUrl = null;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('facebook.com') && href.includes('/') && !fbUrl) {
        const match = href.match(/https?:\/\/(www\.)?facebook\.com\/[^&"'\s]+/);
        if (match) fbUrl = match[0];
      }
    });

    if (!fbUrl) return null;

    const aboutUrl = fbUrl.replace(/\/$/, '') + '/about';
    const fbHtml = await fetchPage(aboutUrl, 8000);
    if (!fbHtml) return null;

    const emails = cleanEmails(extractEmails(fbHtml), 'facebook.com');
    if (emails.length) return { email: emails[0], source: 'facebook' };
  } catch {
    // ignore
  }
  return null;
}

function buildPatternEmails(websiteUrl, businessName) {
  if (!websiteUrl) return [];
  try {
    const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : 'https://' + websiteUrl);
    const domain = url.hostname.replace(/^www\./, '');
    const prefixes = ['info', 'contact', 'service', 'hello', 'office', 'admin'];
    return prefixes.map(p => ({ email: `${p}@${domain}`, source: 'pattern' }));
  } catch {
    return [];
  }
}

async function findEmail(businessName, websiteUrl, city) {
  // Step 1: Scrape website
  const websiteResult = await scrapeWebsite(websiteUrl);
  if (websiteResult) return websiteResult;

  // Step 2: Facebook
  const fbResult = await scrapeFacebook(businessName, city);
  if (fbResult) return fbResult;

  // Step 3: Pattern fallback
  const patterns = buildPatternEmails(websiteUrl, businessName);
  if (patterns.length) return { email: patterns[0].email, source: 'pattern', allPatterns: patterns.map(p => p.email) };

  return { email: null, source: null };
}

module.exports = { findEmail };
