import React, { useState, useRef, useCallback } from 'react';
import { VERTICALS, VERTICAL_LABELS } from '../utils/api';

// ── Column name aliases ──────────────────────────────────────────────────────
// Covers: Google Maps, Outscraper, Apollo, Yelp, manual spreadsheets
const COLUMN_ALIASES = {
  name:        ['name','business','company','business name','company name','title','place name',
                 'business_name','biz_name','store name','merchant','organization','firm',
                 'account name','dba','trade name','legal name'],
  city:        ['city','town','market','city name','locality','municipality'],
  state:       ['state','st','province','region','state/province','state_province','state code'],
  cityState:   ['city/state','city, state','location','city & state','city_state','city (state)',
                 'city state','market area'],
  address:     ['address','addr','full address','street','formatted address','full_address',
                 'street address','mailing address','business address','location address','place address'],
  zip:         ['zip','zipcode','zip code','postal','postal code','zip_code'],
  phone:       ['phone','tel','telephone','phone number','contact','phone_1','phone1','mobile',
                 'cell','direct phone','work phone','office phone','main phone','business phone',
                 'phone number 1','formatted_phone_number'],
  website:     ['website','url','web','site','site url','website url','homepage','domain',
                 'web address','site_name','http'],
  email:       ['email','mail','email address','e-mail','email_1','email_2','contact email','work email',
                 'business email','owner email','primary email','email address 1','email 1',
                 'email_address','e_mail','emailaddress'],
  rating:      ['rating','stars','score','google rating','avg rating','average rating',
                 'star rating','review score','rating_local_business','place_rating'],
  reviewCount: ['reviews','review count','num reviews','number of reviews','ratings',
                 'total reviews','review_count','reviews_count','user_ratings_total',
                 'number_of_reviews','google reviews','reviews total'],
  vertical:    ['vertical','category','type','industry','trade','category_1','business type',
                 'service type','niche','primary category','main category','place_type'],
  linkedinUrl: ['linkedin','linkedin url','linkedin_url','linkedin profile','li url',
                 'linkedin link','linkedin page'],
  notes:       ['notes','note','comments','comment','description','details','memo',
                 'internal notes','sales notes'],
  status:      ['status','lead status','pipeline','stage','crm status','outreach status'],
};

const FIELD_OPTIONS = [
  { value: '',           label: '— Skip —' },
  { value: 'name',       label: 'Business Name' },
  { value: 'phone',      label: 'Phone' },
  { value: 'city',       label: 'City' },
  { value: 'state',      label: 'State' },
  { value: 'cityState',  label: 'City + State (combined)' },
  { value: 'address',    label: 'Full Address' },
  { value: 'zip',        label: 'ZIP Code' },
  { value: 'website',    label: 'Website URL' },
  { value: 'email',      label: 'Email' },
  { value: 'rating',     label: 'Rating (0–5)' },
  { value: 'reviewCount',label: 'Review Count' },
  { value: 'vertical',   label: 'Vertical / Category' },
  { value: 'linkedinUrl',label: 'LinkedIn URL' },
  { value: 'notes',      label: 'Notes' },
  { value: 'status',     label: 'Status' },
];

const VALID_STATUSES = new Set(['New','Researching','Contacted','Replied','Qualified','Closed']);
const STATUS_NORMALIZE = {
  new:'New', lead:'New', prospect:'New', fresh:'New',
  researching:'Researching', research:'Researching', working:'Researching',
  contacted:'Contacted', contact:'Contacted', sent:'Contacted', emailed:'Contacted', pitched:'Contacted',
  replied:'Replied', reply:'Replied', responded:'Replied', response:'Replied',
  qualified:'Qualified', qualify:'Qualified', hot:'Qualified',
  closed:'Closed', won:'Closed', converted:'Closed', customer:'Closed',
};

const VERTICAL_PATTERNS = {
  hvac:        /hvac|heating|cooling|air.?cond|furnace|duct|refriger/i,
  plumbing:    /plumb|drain|sewer|pipe|water.?heat/i,
  electrical:  /electric|wiring|electrician|solar|generator/i,
  roofing:     /roof|gutter|shingle|siding|soffit/i,
  landscaping: /landscap|lawn|garden|yard|mow|tree|sod|irrigation|snow.?remov/i,
};

// ── State helpers ────────────────────────────────────────────────────────────
const US_STATES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',
  IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
  ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',
  MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
  OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
  TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',
  WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC',
};

function normalizeState(raw) {
  if (!raw) return '';
  const up = raw.trim().toUpperCase();
  if (US_STATES[up]) return up;
  const lower = raw.trim().toLowerCase();
  const found = Object.entries(US_STATES).find(([, n]) => n.toLowerCase() === lower);
  return found ? found[0] : raw.trim().slice(0, 2).toUpperCase();
}

function splitCityState(raw) {
  if (!raw) return { city: '', state: '' };
  const m = raw.match(/^(.+?),?\s+([A-Z]{2})$/);
  if (m) return { city: m[1].trim(), state: m[2] };
  return { city: raw.trim(), state: '' };
}

// "123 Main St, Charlotte, NC 28201" → { city: "Charlotte", state: "NC" }
function cityStateFromAddress(addr) {
  if (!addr) return null;
  const m = addr.match(/,\s*([A-Za-z\s]{2,}),\s*([A-Z]{2})\s*\d{0,5}$/);
  if (m) return { city: m[1].trim(), state: m[2] };
  return null;
}

// ── Detection ────────────────────────────────────────────────────────────────
function detectByName(headers) {
  const map = {};
  const usedCols = new Set();

  // Match priority: exact > multi-word phrase > single-word exact only
  // This prevents "Business Email" matching 'name' via the word "business"
  function tryMatch(lower, aliases) {
    return (
      aliases.find(a => lower === a) ||                                    // exact match
      aliases.find(a => a.includes(' ') && lower.includes(a)) ||          // multi-word phrase (e.g. "business email")
      aliases.find(a => !a.includes(' ') && a.length > 4 && lower === a)  // long single-word exact fallback
    );
  }

  headers.forEach((h, i) => {
    if (usedCols.has(i)) return;
    const lower = h.toLowerCase().trim().replace(/[_\-]/g, ' ');
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[field] !== undefined) continue;
      if (usedCols.has(i)) return;
      if (tryMatch(lower, aliases)) {
        map[field] = i;
        usedCols.add(i);
        break;
      }
    }
  });
  return map;
}

function detectByValues(headers, rows, existing) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[\d\s()+\-.]{7,20}$/;
  const URL_RE   = /^https?:\/\//i;
  const LI_RE    = /linkedin\.com/i;
  const RATING_RE = /^[0-5](\.\d+)?$/;
  const INT_RE    = /^\d{1,6}$/;

  const used = new Set(Object.values(existing));
  const result = { ...existing };

  // Scan up to 30 rows for better detection on sparse data
  headers.forEach((h, i) => {
    if (used.has(i)) return;
    const allSamples = rows.slice(0, 30).map(r => (r[i] || '').trim());
    const samples = allSamples.filter(Boolean);
    if (!samples.length) return;

    // LinkedIn: any match
    if (!result.linkedinUrl && samples.some(v => LI_RE.test(v))) { result.linkedinUrl = i; used.add(i); return; }
    // Email: any 1+ valid email found in column (scraped data is often sparse)
    if (!result.email && samples.some(v => EMAIL_RE.test(v))) { result.email = i; used.add(i); return; }
    // Website: 40% threshold (URLs can be missing too)
    if (!result.website && samples.filter(v => URL_RE.test(v)).length >= samples.length * 0.4) { result.website = i; used.add(i); return; }
    // Phone: 50% threshold
    if (!result.phone && samples.filter(v => PHONE_RE.test(v) && v.replace(/\D/g,'').length >= 7).length >= samples.length * 0.5) { result.phone = i; used.add(i); return; }
    if (!result.rating && samples.every(v => RATING_RE.test(v))) { result.rating = i; used.add(i); return; }
    if (!result.reviewCount && samples.every(v => INT_RE.test(v)) && samples.some(v => parseInt(v) > 5)) { result.reviewCount = i; used.add(i); return; }
  });

  return result;
}

// ── CSV parser ───────────────────────────────────────────────────────────────
function parseLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(parseLine);
  return { headers, rows };
}

// ── Row conversion ───────────────────────────────────────────────────────────
function rowToLead(row, colMap, defaultVertical) {
  const get = f => (colMap[f] !== undefined && colMap[f] !== null) ? (row[colMap[f]] || '').trim() : '';

  let city = get('city'), state = get('state');

  if (colMap.cityState !== undefined && (!city || !state)) {
    const p = splitCityState(get('cityState'));
    if (!city) city = p.city;
    if (!state) state = p.state;
  }

  // Try to extract city/state from full address if still missing
  if ((!city || !state) && colMap.address !== undefined) {
    const p = cityStateFromAddress(get('address'));
    if (p) { if (!city) city = p.city; if (!state) state = p.state; }
  }

  // Try treating city field as "City, ST" combo
  if (city && !state) {
    const p = splitCityState(city);
    city = p.city; state = p.state;
  }

  state = normalizeState(state);

  // Vertical: try exact mapping first, then pattern match
  const rawV = get('vertical').toLowerCase().replace(/[\s\-]/g, '');
  let vertical = Object.keys(VERTICAL_LABELS).find(v => v === rawV) || defaultVertical;
  if (vertical === defaultVertical && colMap.vertical !== undefined) {
    const vRaw = get('vertical');
    for (const [v, re] of Object.entries(VERTICAL_PATTERNS)) {
      if (re.test(vRaw)) { vertical = v; break; }
    }
  }

  // Status
  const rawStatus = get('status').toLowerCase().trim();
  const status = VALID_STATUSES.has(get('status')) ? get('status')
    : STATUS_NORMALIZE[rawStatus] || 'New';

  const email = get('email') || null;
  const website = (() => {
    const w = get('website');
    if (!w) return null;
    return /^https?:\/\//i.test(w) ? w : `https://${w}`;
  })();

  return {
    name:        get('name') || null,
    city,
    state,
    address:     get('address') || null,
    zip:         get('zip') || null,
    phone:       get('phone') || null,
    website,
    email,
    emailSource: email ? 'csv' : null,
    rating:      parseFloat(get('rating')) || null,
    reviewCount: parseInt(get('reviewCount')) || 0,
    vertical,
    linkedinUrl: get('linkedinUrl') || null,
    notes:       get('notes') || null,
    status,
  };
}

function rowsToLeads(rows, colMap, defaultVertical) {
  return rows
    .map(r => rowToLead(r, colMap, defaultVertical))
    .filter(l => l.name);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CsvImportModal({ onClose, onImport }) {
  const [step, setStep] = useState('upload');
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [colMap, setColMap] = useState({});
  const [defaultVertical, setDefaultVertical] = useState('hvac');
  const [error, setError] = useState(null);
  const [importCount, setImportCount] = useState(0);
  const [showMapping, setShowMapping] = useState(false);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) { setError('Please upload a .csv file'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = e => {
      const { headers, rows } = parseCSV(e.target.result);
      if (!headers.length) { setError('Could not parse CSV — is the file empty?'); return; }
      const byName = detectByName(headers);
      const byVal  = detectByValues(headers, rows, byName);
      setParsed({ headers, rows });
      setColMap(byVal);
      setShowMapping(false);
      setStep('preview');
    };
    reader.readAsText(file);
  }

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  function fieldForCol(colIdx) {
    return Object.entries(colMap).find(([, i]) => i === colIdx)?.[0] || '';
  }

  function setColMapping(colIdx, newField) {
    setColMap(prev => {
      const next = { ...prev };
      Object.entries(next).forEach(([f, i]) => { if (i === colIdx) delete next[f]; });
      if (newField && next[newField] !== undefined) delete next[newField];
      if (newField) next[newField] = colIdx;
      return next;
    });
  }

  async function handleImport() {
    setStep('importing');
    const leads = rowsToLeads(parsed.rows, colMap, defaultVertical);
    try {
      const result = await onImport(leads);
      setImportCount(result.imported || result.leads?.length || leads.length);
      setStep('done');
    } catch (err) {
      setError(err.message); setStep('preview');
    }
  }

  const previewLeads = parsed ? rowsToLeads(parsed.rows.slice(0, 5), colMap, defaultVertical) : [];
  const detectedFields = Object.keys(colMap);
  const missedName = colMap.name === undefined;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="modal-title" style={{ margin: 0 }}>Import CSV</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* ── UPLOAD ── */}
        {step === 'upload' && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border2)'}`,
                borderRadius: 8, padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'rgba(251,191,36,0.05)' : 'var(--bg)', transition: 'all 0.15s', marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
              <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 4, fontWeight: 500 }}>
                Drop a CSV here, or click to browse
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Auto-detects columns from Google Maps, Outscraper, Apollo, Yelp, or any spreadsheet
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
            </div>

            <div className="alert alert-info" style={{ fontSize: 12 }}>
              <span>💡</span>
              <div>
                <strong>Detected automatically:</strong> Business Name, Phone, City, State, Website, Email, Rating, Review Count, Vertical, LinkedIn, Notes, Status.
                Column headers don't need to match exactly — common variations are recognized. You can also fix any mapping after upload.
              </div>
            </div>
            {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}
          </>
        )}

        {/* ── PREVIEW + MAPPING ── */}
        {step === 'preview' && parsed && (
          <>
            {/* Detected fields badges */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="form-label" style={{ marginBottom: 0 }}>
                  Auto-detected {detectedFields.length} of {FIELD_OPTIONS.length - 1} fields
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowMapping(m => !m)}
                  style={{ fontSize: 11 }}>
                  {showMapping ? 'Hide' : 'Fix column mapping'} ↕
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {FIELD_OPTIONS.slice(1).map(({ value, label }) => {
                  const detected = colMap[value] !== undefined
                    || (value === 'city'  && colMap.cityState !== undefined)
                    || (value === 'state' && colMap.cityState !== undefined);
                  return (
                    <span key={value} style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 3,
                      background: detected ? 'rgba(29,185,84,0.12)' : 'var(--bg)',
                      border: `1px solid ${detected ? 'rgba(29,185,84,0.3)' : 'var(--border)'}`,
                      color: detected ? 'var(--green)' : 'var(--text-dim)',
                    }}>
                      {detected ? '✓' : '–'} {label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Column mapping override UI */}
            {showMapping && (
              <div style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg)', padding: '8px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                  Column Mapping — {parsed.headers.length} columns detected
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {parsed.headers.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 12px', borderBottom: '1px solid var(--border)', background: fieldForCol(i) ? 'rgba(29,185,84,0.04)' : 'transparent' }}>
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h || `Column ${i + 1}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {parsed.rows[0]?.[i] || '—'}
                      </div>
                      <select
                        className="form-select"
                        value={fieldForCol(i)}
                        onChange={e => setColMapping(i, e.target.value)}
                        style={{ width: 180, fontSize: 11, padding: '3px 6px' }}
                      >
                        {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Default vertical + row count */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
              <div>
                <div className="form-label">Default vertical</div>
                <select className="form-select" style={{ width: 160 }} value={defaultVertical} onChange={e => setDefaultVertical(e.target.value)}>
                  {VERTICALS.map(v => <option key={v} value={v}>{VERTICAL_LABELS[v]}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 6 }}>
                Used for rows without a detectable category.
              </div>
            </div>

            {/* Preview table */}
            <div className="form-label" style={{ marginBottom: 6 }}>
              Preview — first {Math.min(5, parsed.rows.length)} of {parsed.rows.length} rows
            </div>
            <div className="table-wrap" style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 14, border: '1px solid var(--border)', borderRadius: 5 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th>Rating</th>
                    <th>Email</th>
                    <th>Vertical</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLeads.map((l, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{l.name}</td>
                      <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l.phone || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{[l.city, l.state].filter(Boolean).join(', ') || '—'}</td>
                      <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{l.rating ? `⭐ ${l.rating}` : '—'}</td>
                      <td style={{ fontSize: 11, color: l.email ? 'var(--green)' : 'var(--text-dim)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.email || '—'}</td>
                      <td style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{l.vertical}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missedName && (
              <div className="alert alert-warning" style={{ marginBottom: 12, fontSize: 12 }}>
                Could not detect a Name column. Use "Fix column mapping" above to assign one, or make sure your CSV has a column called Name, Business, or Company.
              </div>
            )}
            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setStep('upload'); setParsed(null); setError(null); }}>← Back</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={missedName}>
                Import {parsed.rows.length} leads
              </button>
            </div>
          </>
        )}

        {/* ── IMPORTING ── */}
        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
            <div style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: 13 }}>Importing leads...</div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 6 }}>
              {importCount} leads imported
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Missed revenue auto-calculated. Follow-up sequence ready to start.
            </div>
            <button className="btn btn-primary" onClick={onClose}>View in CRM</button>
          </div>
        )}
      </div>
    </div>
  );
}
