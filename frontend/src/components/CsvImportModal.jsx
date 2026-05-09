import React, { useState, useRef, useCallback } from 'react';
import { VERTICALS, VERTICAL_LABELS } from '../utils/api';

const COLUMN_MAP = {
  name:        ['name', 'business', 'company', 'business name', 'company name', 'title'],
  city:        ['city', 'town', 'market', 'city name'],
  state:       ['state', 'st', 'province', 'region', 'state/province'],
  cityState:   ['city/state', 'city, state', 'location', 'city & state'],
  address:     ['address', 'addr', 'full address', 'street', 'formatted address'],
  phone:       ['phone', 'tel', 'telephone', 'phone number', 'contact'],
  website:     ['website', 'url', 'web', 'site', 'website url', 'homepage'],
  email:       ['email', 'mail', 'email address', 'e-mail'],
  rating:      ['rating', 'stars', 'score', 'google rating', 'avg rating'],
  reviewCount: ['reviews', 'review count', 'num reviews', 'number of reviews', 'ratings', 'total reviews'],
  vertical:    ['vertical', 'category', 'type', 'industry', 'trade'],
};

// Parse "Charlotte, NC" or "Charlotte NC" → { city, state }
function splitCityState(raw) {
  if (!raw) return { city: '', state: '' };
  const match = raw.match(/^(.+?),?\s+([A-Z]{2})$/);
  if (match) return { city: match[1].trim(), state: match[2] };
  return { city: raw.trim(), state: '' };
}

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

// Normalize state: "NC", "North Carolina", "north carolina" → "NC"
function normalizeState(raw) {
  if (!raw) return '';
  const up = raw.trim().toUpperCase();
  if (US_STATES[up]) return up;
  const lower = raw.trim().toLowerCase();
  const match = Object.entries(US_STATES).find(([, name]) => name.toLowerCase() === lower);
  return match ? match[0] : raw.trim().slice(0, 2).toUpperCase();
}

function detectColumns(headers) {
  const mapping = {};
  headers.forEach((h, i) => {
    const lower = h.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
      if (!mapping[field] && aliases.some(a => lower === a || lower.includes(a))) {
        mapping[field] = i;
      }
    }
  });
  return mapping;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(parseLine);
  return { headers, rows };
}

function rowsToLeads(rows, headers, colMap, defaultVertical) {
  const knownVerticals = Object.keys(VERTICAL_LABELS);
  return rows.map(row => {
    const get = (field) => colMap[field] !== undefined ? (row[colMap[field]] || '').trim() : '';

    // City + state resolution
    let city = get('city');
    let state = get('state');

    if (colMap.cityState !== undefined) {
      // dedicated "city/state" or "location" column like "Charlotte, NC"
      const parsed = splitCityState(get('cityState'));
      if (!city) city = parsed.city;
      if (!state) state = parsed.state;
    } else if (!state && city) {
      // try to extract state from the city field itself
      const parsed = splitCityState(city);
      city = parsed.city;
      state = parsed.state;
    }

    state = normalizeState(state);

    const rawVertical = (get('vertical') || defaultVertical).toLowerCase().replace(/[\s-]/g, '');
    const vertical = knownVerticals.includes(rawVertical) ? rawVertical : defaultVertical;

    return {
      name:        get('name') || 'Unknown Business',
      city,
      state,
      address:     get('address') || '',
      phone:       get('phone') || null,
      website:     get('website') || null,
      email:       get('email') || null,
      emailSource: get('email') ? 'csv' : null,
      rating:      parseFloat(get('rating')) || null,
      reviewCount: parseInt(get('reviewCount')) || 0,
      vertical,
    };
  }).filter(l => l.name && l.name !== 'Unknown Business');
}

// Fields shown in the detected-columns badge row
const BADGE_FIELDS = ['name','city','state','address','phone','website','email','rating','reviewCount','vertical'];

export default function CsvImportModal({ onClose, onImport }) {
  const [step, setStep] = useState('upload');
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [colMap, setColMap] = useState({});
  const [defaultVertical, setDefaultVertical] = useState('hvac');
  const [error, setError] = useState(null);
  const [importCount, setImportCount] = useState(0);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a .csv file');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      if (!headers.length) { setError('Could not parse CSV — is the file empty?'); return; }
      const detected = detectColumns(headers);
      setParsed({ headers, rows });
      setColMap(detected);
      setStep('preview');
    };
    reader.readAsText(file);
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  async function handleImport() {
    setStep('importing');
    const leads = rowsToLeads(parsed.rows, parsed.headers, colMap, defaultVertical);
    try {
      const result = await onImport(leads);
      setImportCount(result.imported);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('preview');
    }
  }

  const previewLeads = parsed
    ? rowsToLeads(parsed.rows.slice(0, 5), parsed.headers, colMap, defaultVertical)
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="modal-title" style={{ margin: 0 }}>Import CSV</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* UPLOAD */}
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
                background: dragOver ? 'var(--accent-dim)' : 'var(--bg)', transition: 'all 0.15s', marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
              <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 4, fontWeight: 500 }}>
                Drop a CSV file here, or click to browse
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Supports exports from Google Maps, Outscraper, Apollo, or any spreadsheet
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
            </div>

            <div className="alert alert-info" style={{ fontSize: 12 }}>
              <span>💡</span>
              <div>
                Columns are auto-detected by name. Useful headers: <code>Name</code>, <code>City</code>, <code>State</code>,{' '}
                <code>Website</code>, <code>Phone</code>, <code>Email</code>, <code>Rating</code>, <code>Reviews</code>.{' '}
                A combined <code>City/State</code> column like <em>"Charlotte, NC"</em> also works.
              </div>
            </div>

            {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}
          </>
        )}

        {/* PREVIEW */}
        {step === 'preview' && parsed && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="form-label">Default vertical</div>
                <select className="form-select" style={{ width: 160 }} value={defaultVertical} onChange={e => setDefaultVertical(e.target.value)}>
                  {VERTICALS.map(v => <option key={v} value={v}>{VERTICAL_LABELS[v]}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 6 }}>
                Applied to rows without a detectable vertical.
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="form-label" style={{ marginBottom: 6 }}>Detected columns</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {BADGE_FIELDS.map(field => {
                  const detected = colMap[field] !== undefined || (field === 'city' && colMap.cityState !== undefined) || (field === 'state' && colMap.cityState !== undefined);
                  return (
                    <span key={field} style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 3,
                      background: detected ? 'rgba(29,185,84,0.12)' : 'var(--bg)',
                      border: `1px solid ${detected ? 'rgba(29,185,84,0.3)' : 'var(--border)'}`,
                      color: detected ? 'var(--green)' : 'var(--text-dim)',
                    }}>
                      {detected ? '✓' : '–'} {field}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="form-label" style={{ marginBottom: 6 }}>
              Preview — first 5 of {parsed.rows.length} rows
            </div>
            <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 5 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Vertical</th>
                    <th>Website</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLeads.map((l, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{l.city || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{l.state || '—'}</td>
                      <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{l.vertical}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.website || '—'}</td>
                      <td style={{ fontSize: 11, color: l.email ? 'var(--green)' : 'var(--text-dim)' }}>{l.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

            {!colMap.name && (
              <div className="alert alert-warning" style={{ marginBottom: 12, fontSize: 12 }}>
                Could not detect a "Name" column. Make sure your CSV has a column called Name, Business, or Company.
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setStep('upload'); setParsed(null); setError(null); }}>← Back</button>
              <button className="btn btn-primary" onClick={handleImport}>
                Import {parsed.rows.length} leads
              </button>
            </div>
          </>
        )}

        {/* IMPORTING */}
        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
            <div style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: 13 }}>Importing leads...</div>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--green)', marginBottom: 6 }}>
              {importCount} leads imported
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Missed revenue auto-calculated for every lead.
            </div>
            <button className="btn btn-primary" onClick={onClose}>View in CRM</button>
          </div>
        )}
      </div>
    </div>
  );
}
