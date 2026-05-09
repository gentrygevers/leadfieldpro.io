import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, VERTICALS, VERTICAL_LABELS, formatMoney } from '../utils/api';

const VERTICAL_BENCHMARKS = {
  hvac: { calls: 28, closeRate: 0.42, avgTicket: 485, answerRate: 0.78 },
  plumbing: { calls: 22, closeRate: 0.55, avgTicket: 310, answerRate: 0.80 },
  electrical: { calls: 18, closeRate: 0.48, avgTicket: 420, answerRate: 0.75 },
  roofing: { calls: 12, closeRate: 0.35, avgTicket: 8500, answerRate: 0.70 },
  landscaping: { calls: 35, closeRate: 0.60, avgTicket: 280, answerRate: 0.82 }
};

export default function FindLeads() {
  const [city, setCity] = useState('');
  const [vertical, setVertical] = useState('hvac');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const b = VERTICAL_BENCHMARKS[vertical];
  const missedCalls = Math.round(b.calls * (1 - b.answerRate));
  const missedLeads = Math.round(missedCalls * b.closeRate);
  const monthlyMissed = missedLeads * b.avgTicket;

  async function handleSearch(e) {
    e.preventDefault();
    if (!city.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const data = await api.searchLeads(city.trim(), vertical);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Find Leads</div>
        <div className="page-sub">Search for businesses not running Google Local Service Ads</div>
      </div>

      {/* Benchmark preview */}
      <div className="card mb-20" style={{ background: 'rgba(240,165,0,0.05)', borderColor: 'rgba(240,165,0,0.2)' }}>
        <div className="section-title" style={{ marginBottom: '10px' }}>Market Benchmark — {VERTICAL_LABELS[vertical]}</div>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {[
            ['LSA Calls/mo', b.calls],
            ['Missed calls', missedCalls],
            ['Missed jobs/mo', missedLeads],
            ['Avg ticket', formatMoney(b.avgTicket)],
            ['Monthly gap', <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{formatMoney(monthlyMissed)}</span>]
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search form */}
      <div className="card mb-20">
        <form onSubmit={handleSearch} className="search-form" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
            <label className="form-label">City / Market</label>
            <input
              className="form-input"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. Charlotte NC, Denver CO"
              required
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="form-label">Vertical</label>
            <select className="form-select" value={vertical} onChange={e => setVertical(e.target.value)}>
              {VERTICALS.map(v => <option key={v} value={v}>{VERTICAL_LABELS[v]}</option>)}
            </select>
          </div>
          <div style={{ paddingBottom: '0' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '18px' }}>
              {loading ? <><span className="spinner" /> Searching...</> : <><SearchIcon /> Search Market</>}
            </button>
          </div>
        </form>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '12px' }}>
            <WarningIcon /> {error.includes('GOOGLE_PLACES_API_KEY') ? 'Google Places API key not configured. Add it in Settings.' : error}
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="card">
          <div className="section-row">
            <div className="section-title">{results.count} leads found · saved to CRM</div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/crm')}>
              View in CRM →
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Address</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                  <th>Monthly Gap</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {results.leads.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 500 }}>{l.name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{l.address}</td>
                    <td className="td-mono">{l.rating ? `⭐ ${l.rating}` : '—'}</td>
                    <td className="td-mono">{l.reviewCount || '—'}</td>
                    <td className="td-mono" style={{ color: 'var(--accent)' }}>{formatMoney(l.missedRevenue)}/mo</td>
                    <td>
                      {l.website
                        ? <a href={l.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px' }}>↗ site</a>
                        : <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>none</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!results && !loading && (
        <div className="empty-state">
          <SearchIcon2 />
          <h3>Ready to find gaps</h3>
          <p>Enter a city and vertical above to find businesses not running LSA and calculate their missed revenue.</p>
        </div>
      )}
    </div>
  );
}

function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>; }
function SearchIcon2() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>; }
function WarningIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
