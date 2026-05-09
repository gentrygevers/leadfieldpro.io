import React, { useState, useEffect, useCallback } from 'react';
import { api, STATUSES, VERTICAL_LABELS, formatMoney, statusBadgeClass, sourceTagClass } from '../utils/api';
import { buildPitchEmail, buildGmailUrl } from '../utils/pitch';

export default function CRM() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [findingEmail, setFindingEmail] = useState(new Set());
  const [batchFinding, setBatchFinding] = useState(false);
  const [pitchModal, setPitchModal] = useState(null);

  const fetchLeads = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (searchQ) params.search = searchQ;
      const data = await api.getLeads(params);
      setLeads(data);
    } catch {}
  }, [statusFilter, searchQ]);

  useEffect(() => {
    setLoading(true);
    fetchLeads().finally(() => setLoading(false));
  }, [fetchLeads]);

  async function handleFindEmail(lead) {
    setFindingEmail(prev => new Set([...prev, lead.id]));
    try {
      const result = await api.findEmail(lead.id);
      setLeads(prev => prev.map(l => l.id === lead.id ? result.lead : l));
    } catch (err) {
      alert('Error finding email: ' + err.message);
    } finally {
      setFindingEmail(prev => { const s = new Set(prev); s.delete(lead.id); return s; });
    }
  }

  async function handleBatchFind() {
    const ids = [...selected].filter(id => {
      const l = leads.find(x => x.id === id);
      return l && !l.email;
    });
    if (!ids.length) return;
    setBatchFinding(true);
    try {
      const result = await api.findEmailsBatch(ids);
      const updatedMap = {};
      result.results.forEach(r => { if (r.lead) updatedMap[r.id] = r.lead; });
      setLeads(prev => prev.map(l => updatedMap[l.id] ? updatedMap[l.id] : l));
    } catch (err) {
      alert('Batch error: ' + err.message);
    } finally {
      setBatchFinding(false);
      setSelected(new Set());
    }
  }

  async function handleStatusChange(lead, newStatus) {
    try {
      const updated = await api.updateLead(lead.id, { status: newStatus });
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l));
    } catch {}
  }

  async function handleDelete(lead) {
    if (!confirm(`Delete ${lead.name}?`)) return;
    try {
      await api.deleteLead(lead.id);
      setLeads(prev => prev.filter(l => l.id !== lead.id));
    } catch {}
  }

  function openPitch(lead) {
    const { subject, body } = buildPitchEmail(lead);
    setPitchModal({ lead, subject, body });
  }

  async function markSent(lead) {
    try {
      const updated = await api.updateLead(lead.id, { status: 'Contacted' });
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l));
    } catch {}
    setPitchModal(null);
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function toggleAll() {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map(l => l.id)));
  }

  const selectedWithoutEmail = [...selected].filter(id => { const l = leads.find(x => x.id === id); return l && !l.email; }).length;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">CRM Pipeline</div>
        <div className="page-sub">Manage and track your lead outreach</div>
      </div>

      {/* Pipeline steps */}
      <div className="pipeline">
        {STATUSES.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`pipeline-step${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)} style={{ cursor: 'pointer' }}>
              <div className="pipeline-dot" />
              {s}
            </div>
            {i < STATUSES.length - 1 && <span className="pipeline-arrow">→</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <input
          className="form-input"
          placeholder="Search name or city..."
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {selected.size > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleBatchFind}
            disabled={batchFinding || selectedWithoutEmail === 0}
          >
            {batchFinding ? <><span className="spinner" /> Finding...</> : <><EmailIcon /> Find {selectedWithoutEmail} emails</>}
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {leads.length} leads
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state"><span className="spinner" style={{ width: 24, height: 24 }} /></div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <EmptyIcon />
            <h3>No leads found</h3>
            <p>Search a market to add leads, or adjust your filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selected.size === leads.length && leads.length > 0} onChange={toggleAll} /></th>
                  <th>Business</th>
                  <th>City</th>
                  <th>Vertical</th>
                  <th>Rating</th>
                  <th>Email</th>
                  <th>Monthly Gap</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id}>
                    <td><input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} /></td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '13px' }}>{lead.name}</div>
                      {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>↗ website</a>}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{lead.city}</td>
                    <td>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {VERTICAL_LABELS[lead.vertical] || lead.vertical}
                      </span>
                    </td>
                    <td className="td-mono">{lead.rating ? `⭐ ${lead.rating}` : '—'}</td>
                    <td>
                      {lead.email ? (
                        <span style={{ fontSize: '12px' }}>
                          {lead.email}
                          <span className={sourceTagClass(lead.emailSource)}>{lead.emailSource}</span>
                        </span>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleFindEmail(lead)}
                          disabled={findingEmail.has(lead.id)}
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                        >
                          {findingEmail.has(lead.id) ? <span className="spinner" /> : <><EmailIcon /> Find</>}
                        </button>
                      )}
                    </td>
                    <td className="td-mono" style={{ color: 'var(--accent)' }}>{formatMoney(lead.missedRevenue)}/mo</td>
                    <td>
                      <select
                        className="form-select"
                        value={lead.status}
                        onChange={e => handleStatusChange(lead, e.target.value)}
                        style={{ width: '120px', padding: '4px 8px', fontSize: '11px' }}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openPitch(lead)}
                          disabled={!lead.email}
                          title={lead.email ? 'Send pitch' : 'Find email first'}
                        >
                          <SendIcon />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lead)}>
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pitch modal */}
      {pitchModal && (
        <div className="modal-overlay" onClick={() => setPitchModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Send Pitch — {pitchModal.lead.name}</div>
            <div className="modal-field">
              <label>To</label>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--accent)' }}>{pitchModal.lead.email}</p>
            </div>
            <div className="modal-field">
              <label>Subject</label>
              <p style={{ fontSize: '13px', color: 'var(--text)' }}>{pitchModal.subject}</p>
            </div>
            <div className="modal-field">
              <label>Body</label>
              <div className="modal-body-text">{pitchModal.body}</div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setPitchModal(null)}>Cancel</button>
              <button
                className="btn btn-secondary"
                onClick={() => markSent(pitchModal.lead)}
              >
                Mark Sent
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  window.open(buildGmailUrl(pitchModal.lead.email, pitchModal.subject, pitchModal.body), '_blank');
                }}
              >
                <GmailIcon /> Open in Gmail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function SendIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>; }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>; }
function EmptyIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function GmailIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>; }
