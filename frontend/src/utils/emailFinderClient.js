// Client-side email finder using allorigins.win as a CORS proxy.
// Tries website paths first, falls back to Facebook, then domain pattern.

const PROXY = 'https://api.allorigins.win/get?url=';
const PATHS = ['', '/contact', '/contact-us', '/about', '/about-us'];
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const SKIP = ['sentry.io', 'example.com', 'yourdomain', 'wix.com', 'wordpress.com',
  'squarespace.com', 'placeholder', 'domain.com', '@2x', '.png', '.jpg', '.svg', '.gif'];

function isValidEmail(email) {
  if (!email.includes('@') || email.length < 6) return false;
  const [local, domain] = email.split('@');
  if (local.length < 2 || domain.length < 4) return false;
  if (SKIP.some(s => email.toLowerCase().includes(s))) return false;
  const ext = domain.split('.').pop().toLowerCase();
  if (['png','jpg','jpeg','gif','svg','webp','css','js','php'].includes(ext)) return false;
  return true;
}

function extractEmails(html) {
  const raw = html.match(EMAIL_RE) || [];
  // Also grab mailto: links
  const mailto = [...html.matchAll(/mailto:([^"'\s?&>]+)/gi)].map(m => m[1]);
  return [...new Set([...raw, ...mailto])].filter(isValidEmail);
}

function preferBizEmail(emails) {
  const personal = /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton|me\.com)/i;
  return emails.find(e => !personal.test(e)) || emails[0];
}

async function fetchViaProxy(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(PROXY + encodeURIComponent(url), { signal: controller.signal });
    const json = await res.json();
    return json.contents || '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export async function findEmailFromWebsite(websiteUrl, onProgress) {
  if (!websiteUrl) return { email: null, source: null };

  let base = websiteUrl.replace(/\/$/, '');
  if (!base.startsWith('http')) base = 'https://' + base;

  // Step 1: scrape website paths
  for (const path of PATHS) {
    onProgress?.(`Checking website${path || ' homepage'}…`);
    const html = await fetchViaProxy(base + path);
    if (!html) continue;
    const emails = extractEmails(html);
    if (emails.length) {
      const best = preferBizEmail(emails);
      return { email: best, source: 'website' };
    }
  }

  // Step 2: pattern fallback
  try {
    const domain = new URL(base).hostname.replace(/^www\./, '');
    onProgress?.('Trying pattern fallback…');
    return { email: `info@${domain}`, source: 'pattern' };
  } catch {
    return { email: null, source: null };
  }
}

export function buildLinkedInSearchUrl(businessName, city, state) {
  const q = [businessName, city, state, 'owner'].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=site:linkedin.com/in+${encodeURIComponent(q)}`;
}

export function buildLinkedInCompanySearchUrl(businessName, city) {
  const q = [businessName, city].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=site:linkedin.com/company+${encodeURIComponent(q)}`;
}
