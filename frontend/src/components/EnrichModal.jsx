import React, { useState, useEffect } from 'react';
import { api, sourceTagClass } from '../utils/api';
import { findEmailFromWebsite, buildLinkedInSearchUrl, buildLinkedInCompanySearchUrl } from '../utils/emailFinderClient';

export default function EnrichModal({ lead, onClose, onUpdate }) {
  const [emailStatus, setEmailStatus] = useState('idle'); // idle|searching|found|not_found|error
  const [emailProgress, setEmailProgress] = useState('');
  const [foundEmail, setFoundEmail] = useState(lead.email || '');
  const [foundEmailSource, setFoundEmailSource] = useState(lead.emailSource || '');

  const [linkedinUrl, setLinkedinUrl] = useState(lead.linkedinUrl || '');
  const [linkedinSaved, setLinkedinSaved] = useState(false);

  const [reviewStatus, setReviewStatus] = useState('idle'); // idle|searching|found|error|no_backend
  const [reviewData, setReviewData] = useState({ rating: lead.rating, reviewCount: lead.reviewCount });

  // Auto-start email search if no email yet
  useEffect(() => {
    if (!lead.email && lead.website) runEmailSearch();
  }, []);

  async function runEmailSearch() {
    setEmailStatus('searching');
    setEmailProgress('Starting…');
    try {
      const result = await findEmailFromWebsite(lead.website, (msg) => setEmailProgress(msg));
      if (result.email) {
        setFoundEmail(result.email);
        setFoundEmailSource(result.source);
        setEmailStatus('found');
        // Save to lead
        const updated = await api.updateLead(lead.id, { email: result.email, emailSource: result.source });
        onUpdate?.(updated);
      } else {
        setEmailStatus('not_found');
      }
    } catch {
      setEmailStatus('error');
    }
  }

  async function saveEmail() {
    if (!foundEmail) return;
    const updated = await api.updateLead(lead.id, { email: foundEmail, emailSource: foundEmailSource || 'manual' });
    onUpdate?.(updated);
    setEmailStatus('found');
  }

  async function saveLinkedIn() {
    const updated = await api.updateLead(lead.id, { linkedinUrl });
    onUpdate?.(updated);
    setLinkedinSaved(true);
    setTimeout(() => setLinkedinSaved(false), 2000);
  }

  async function refreshReviews() {
    setReviewStatus('searching');
    try {
      const result = await api.refreshReviews(lead.id);
      setReviewData({ rating: result.rating, reviewCount: result.reviewCount });
      onUpdate?.(result.lead);
      setReviewStatus('found');
    } catch (err) {
      setReviewStatus(err.message?.includes('backend') || err.message?.includes('fetch') ? 'no_backend' : 'error');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="modal-title" style={{ margin: 0 }}>Enrich Lead</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{lead.name} · {lead.city}{lead.state ? `, ${lead.state}` : ''}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* ── EMAIL ── */}
        <Section title="Email" icon="📧">
          {lead.website ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <StatusDot status={emailStatus} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {emailStatus === 'idle' && 'Not searched yet'}
                  {emailStatus === 'searching' && emailProgress}
                  {emailStatus === 'found' && 'Email found'}
                  {emailStatus === 'not_found' && 'No email found on website'}
                  {emailStatus === 'error' && 'Search failed'}
                </span>
                {(emailStatus === 'idle' || emailStatus === 'not_found' || emailStatus === 'error') && (
                  <button className="btn btn-secondary btn-sm" onClick={runEmailSearch}>
                    {emailStatus === 'searching' ? <><span className="spinner" /> Searching</> : 'Search website'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={foundEmail}
                  onChange={e => { setFoundEmail(e.target.value); setEmailStatus('idle'); }}
                  placeholder="email@domain.com"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary btn-sm" onClick={saveEmail} disabled={!foundEmail}>
                  Save
                </button>
              </div>
              {foundEmailSource && (
                <div style={{ marginTop: 6 }}>
                  <span className={sourceTagClass(foundEmailSource)}>{foundEmailSource}</span>
                </div>
              )}
            </>
          ) : (
            <div className="alert alert-warning" style={{ fontSize: 12 }}>
              No website URL on this lead — add one to enable email search.
            </div>
          )}
        </Section>

        <hr className="divider" />

        {/* ── LINKEDIN ── */}
        <Section title="LinkedIn" icon="💼">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <a
              href={buildLinkedInSearchUrl(lead.name, lead.city, lead.state)}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              🔍 Find owner on Google
            </a>
            <a
              href={buildLinkedInCompanySearchUrl(lead.name, lead.city)}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              🏢 Find company page
            </a>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            Opens a Google search for their LinkedIn profile. Paste the URL below once found.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/owner-name"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary btn-sm" onClick={saveLinkedIn} disabled={!linkedinUrl}>
              {linkedinSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          {linkedinUrl && !linkedinSaved && (
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, marginTop: 6, display: 'inline-block' }}>
              Open profile ↗
            </a>
          )}
        </Section>

        <hr className="divider" />

        {/* ── REVIEWS ── */}
        <Section title="Google Reviews" icon="⭐">
          <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
            <Stat label="Rating" value={reviewData.rating ? `⭐ ${reviewData.rating}` : '—'} />
            <Stat label="Review count" value={reviewData.reviewCount || '—'} />
          </div>
          {reviewStatus === 'no_backend' ? (
            <div className="alert alert-warning" style={{ fontSize: 12 }}>
              Refreshing reviews requires the backend + Google Places API key. Deploy Railway to enable.
            </div>
          ) : reviewStatus === 'error' ? (
            <div className="alert alert-error" style={{ fontSize: 12 }}>Failed to refresh. Check your API key.</div>
          ) : reviewStatus === 'found' ? (
            <div className="alert alert-success" style={{ fontSize: 12 }}>✓ Reviews updated from Google.</div>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={refreshReviews}
              disabled={reviewStatus === 'searching'}
            >
              {reviewStatus === 'searching' ? <><span className="spinner" /> Fetching…</> : '↻ Refresh from Google'}
            </button>
          )}
        </Section>

      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span>{icon}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { idle: 'var(--text-dim)', searching: 'var(--accent)', found: 'var(--green)', not_found: 'var(--text-muted)', error: 'var(--red)' };
  return (
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status] || 'var(--text-dim)', display: 'inline-block', flexShrink: 0,
      ...(status === 'searching' ? { animation: 'pulse 1s infinite' } : {}) }} />
  );
}
