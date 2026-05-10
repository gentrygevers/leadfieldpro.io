import React, { useState, useEffect, useCallback } from 'react';
import { api, STATUSES, VERTICAL_LABELS, formatMoney, sourceTagClass } from '../utils/api';
import { buildEmailForStage, buildGmailUrl, advanceSequence, SEQUENCE_LABELS } from '../utils/pitch';
import CsvImportModal from '../components/CsvImportModal';
import EnrichModal from '../components/EnrichModal';
import { isLocalMode } from '../utils/localStore';

const TODAY = new Date().toISOString().slice(0, 10);

function daysLabel(dateStr) {
  const diff = Math.round((new Date(dateStr) - new Date(TODAY)) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  return `in ${diff}d`;
}

function isDue(dateStr) {
  return dateStr && dateStr <= TODAY;
}

export default function CRM() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [sortBy, setSortBy] = useState('missedRevenue');
  const [sortDir, setSortDir] = useState('desc');
  const [pitchModal, setPitchModal] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [enrichLead, setEnrichLead] = useState(null);
  const [notesLead, setNotesLead] = useState(null);
  const [editLead, setEditLead] = useState(null);

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

  // Leads due for follow-up (overdue or today), not complete, not closed
  const followUpQueue = leads
    .filter(l => l.followUpDate && isDue(l.followUpDate) && (l.followUpStage || 0) < 4 && l.status !== 'Closed')
    .sort((a, b) => a.followUpDate < b.followUpDate ? -1 : 1);

  function handleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  const sortedLeads = [...leads].sort((a, b) => {
    const av = a[sortBy] ?? 0, bv = b[sortBy] ?? 0;
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  function exportCsv() {
    const headers = ['Name', 'Phone', 'City', 'State', 'Vertical', 'Website', 'Email', 'Email Source', 'Rating', 'Reviews', 'Monthly Gap', 'Status', 'Follow-up Stage', 'Next Follow-up', 'LinkedIn', 'Notes'];
    const rows = leads.map(l => [
      l.name, l.phone, l.city, l.state,
      VERTICAL_LABELS[l.vertical] || l.vertical,
      l.website, l.email, l.emailSource,
      l.rating, l.reviewCount, l.missedRevenue,
      l.status, SEQUENCE_LABELS[l.followUpStage || 0], l.followUpDate,
      l.linkedinUrl, l.notes,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${TODAY}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function updateLead(id, updates) {
    try {
      const updated = await api.updateLead(id, updates);
      setLeads(prev => prev.map(l => l.id === id ? updated : l));
      return updated;
    } catch {}
  }

  // One-click: opens Gmail with stage-appropriate template, advances sequence
  async function handleSequenceSend(lead) {
    const { subject, body } = buildEmailForStage(lead);
    window.open(buildGmailUrl(lead.email, subject, body), '_blank');
    const seq = advanceSequence(lead);
    await updateLead(lead.id, {
      ...seq,
      status: ['New', 'Researching'].includes(lead.status) ? 'Contacted' : lead.status,
    });
    setPitchModal(null);
  }

  async function handleSnooze(lead, days = 3) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    await updateLead(lead.id, { followUpDate: d.toISOString().slice(0, 10) });
  }

  async function handleMarkSentOther(lead) {
    const seq = advanceSequence(lead);
    await updateLead(lead.id, { ...seq, status: 'Contacted' });
    setPitchModal(null);
  }

  function openPitch(lead) {
    const { subject, body } = buildEmailForStage(lead);
    setPitchModal({ lead, subject, body });
  }

  async function handleStatusChange(lead, newStatus) {
    await updateLead(lead.id, { status: newStatus });
  }

  async function handleDelete(lead) {
    if (!confirm(`Delete ${lead.name}?`)) return;
    try {
      await api.deleteLead(lead.id);
      setLeads(prev => prev.filter(l => l.id !== lead.id));
    } catch {}
  }

  async function handleBulkDelete() {
    const count = selected.size;
    if (!confirm(`Delete ${count} lead${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    const ids = [...selected];
    try {
      await Promise.all(ids.map(id => api.deleteLead(id)));
      setLeads(prev => prev.filter(l => !ids.includes(l.id)));
      setSelected(new Set());
    } catch {}
  }

  async function handleImportLeads(newLeads) {
    const result = await api.importLeads(newLeads);
    await fetchLeads();
    return result;
  }

  function toggleSelect(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function toggleAll() {
    setSelected(selected.size === leads.length ? new Set() : new Set(leads.map(l => l.id)));
  }

  function SortArrow({ col }) {
    if (sortBy !== col) return <span style={{ opacity: 0.25, fontSize: 10 }}>↕</span>;
    return <span style={{ fontSize: 10 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>;
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">CRM Pipeline</div>
          <div className="page-sub">Manage and track your lead outreach</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {leads.length > 0 && (
            <button className="btn btn-secondary" onClick={exportCsv}>
              <DownloadIcon /> Export CSV
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            <UploadIcon /> Import CSV
          </button>
        </div>
      </div>

      {isLocalMode() && (
        <div className="alert alert-warning" style={{ marginBottom: 16, fontSize: 12 }}>
          <span>⚠️</span>
          <span>Backend not connected — data is stored locally in your browser. <a href="/settings" style={{ color: 'var(--accent)' }}>Configure backend →</a></span>
        </div>
      )}

      {/* ── TODAY'S FOLLOW-UP QUEUE ── */}
      {followUpQueue.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)' }}>
              Follow-ups Due — {followUpQueue.length} {followUpQueue.length === 1 ? 'lead' : 'leads'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {followUpQueue.map((lead, i) => (
              <div key={lead.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: i < followUpQueue.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 3 }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10 }}>
                    <span>{[lead.city, lead.state].filter(Boolean).join(', ')}</span>
                    <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                      {SEQUENCE_LABELS[lead.followUpStage || 0]}
                    </span>
                    <span style={{ color: isDue(lead.followUpDate) && lead.followUpDate < TODAY ? 'var(--red)' : 'var(--text-muted)' }}>
                      {daysLabel(lead.followUpDate)}
                    </span>
                    {lead.phone && <a href={`tel:${lead.phone}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{lead.phone}</a>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {lead.email ? (
                    <button className="btn btn-primary btn-sm" onClick={() => handleSequenceSend(lead)}>
                      <GmailIcon /> Open in Gmail
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={() => setEnrichLead(lead)}>
                      Find Email First
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => handleSnooze(lead, 3)} title="Push back 3 days">
                    Snooze 3d
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleSnooze(lead, 7)} title="Push back 7 days">
                    7d
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline steps */}
      <div className="pipeline">
        {STATUSES.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`pipeline-step${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)} style={{ cursor: 'pointer' }}>
              <div className="pipeline-dot" />{s}
            </div>
            {i < STATUSES.length - 1 && <span className="pipeline-arrow">→</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <input className="form-input" placeholder="Search name or city..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {selected.size > 0 && (
          <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} style={{ marginLeft: 8 }}>
            <TrashIcon /> Delete {selected.size} selected
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
                  <th>Phone</th>
                  <th>Location</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('rating')}>
                    Rating <SortArrow col="rating" />
                  </th>
                  <th>Email</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('missedRevenue')}>
                    Monthly Gap <SortArrow col="missedRevenue" />
                  </th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedLeads.map(lead => {
                  const due = lead.followUpDate && isDue(lead.followUpDate) && (lead.followUpStage || 0) < 4;
                  const seqDone = (lead.followUpStage || 0) >= 4;
                  return (
                    <tr key={lead.id} style={due ? { background: 'rgba(251,191,36,0.04)' } : {}}>
                      <td><input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} /></td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{lead.name}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                          {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>↗ website</a>}
                          {lead.linkedinUrl && <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>in/ linkedin</a>}
                        </div>
                      </td>
                      <td>
                        {lead.phone
                          ? <a href={`tel:${lead.phone}`} style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text)', textDecoration: 'none', whiteSpace: 'nowrap' }}>{lead.phone}</a>
                          : <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="td-mono">{lead.rating ? `⭐ ${lead.rating}` : '—'}</td>
                      <td>
                        {lead.email ? (
                          <div>
                            <span style={{ fontSize: '12px' }}>{lead.email}</span>
                            {lead.emailSource && <span className={sourceTagClass(lead.emailSource)}>{lead.emailSource}</span>}
                          </div>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => setEnrichLead(lead)}
                            style={{ padding: '3px 8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <EmailIcon /> Find
                          </button>
                        )}
                      </td>
                      <td className="td-mono" style={{ color: 'var(--accent)' }}>{formatMoney(lead.missedRevenue)}/mo</td>
                      <td>
                        <select className="form-select" value={lead.status}
                          onChange={e => handleStatusChange(lead, e.target.value)}
                          style={{ width: '120px', padding: '4px 8px', fontSize: '11px' }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {/* Follow-up date indicator */}
                        {lead.followUpDate && !seqDone && (
                          <div style={{ fontSize: 10, marginTop: 4, fontFamily: 'var(--font-mono)', color: due ? 'var(--accent)' : 'var(--text-dim)' }}>
                            📅 {SEQUENCE_LABELS[lead.followUpStage || 0]} · {daysLabel(lead.followUpDate)}
                          </div>
                        )}
                        {seqDone && (
                          <div style={{ fontSize: 10, marginTop: 4, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                            ✓ Sequence done
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEnrichLead(lead)} title="Enrich">
                            <EnrichIcon />
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditLead(lead)} title="Edit lead">
                            <PencilIcon />
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setNotesLead(lead)}
                            title={lead.notes ? 'View notes' : 'Add notes'} style={{ position: 'relative' }}>
                            <NotesIcon />
                            {lead.notes && <span style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'block' }} />}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openPitch(lead)}
                            disabled={!lead.email} title={lead.email ? `Send ${SEQUENCE_LABELS[lead.followUpStage || 0]}` : 'Find email first'}>
                            <SendIcon />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lead)}>
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enrich modal */}
      {enrichLead && (
        <EnrichModal lead={enrichLead} onClose={() => setEnrichLead(null)}
          onUpdate={updated => { setLeads(prev => prev.map(l => l.id === updated.id ? updated : l)); setEnrichLead(updated); }} />
      )}

      {/* Notes modal */}
      {notesLead && (
        <NotesModal lead={notesLead} onClose={() => setNotesLead(null)}
          onSave={updated => { setLeads(prev => prev.map(l => l.id === updated.id ? updated : l)); setNotesLead(null); }} />
      )}

      {/* Edit lead modal */}
      {editLead && (
        <EditLeadModal lead={editLead} onClose={() => setEditLead(null)}
          onSave={updated => { setLeads(prev => prev.map(l => l.id === updated.id ? updated : l)); setEditLead(null); }} />
      )}

      {/* CSV import modal */}
      {showImport && <CsvImportModal onClose={() => setShowImport(false)} onImport={handleImportLeads} />}

      {/* Pitch / follow-up modal */}
      {pitchModal && (
        <div className="modal-overlay" onClick={() => setPitchModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="modal-title" style={{ margin: 0 }}>
                {SEQUENCE_LABELS[pitchModal.lead.followUpStage || 0]} — {pitchModal.lead.name}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPitchModal(null)}>✕</button>
            </div>
            {(pitchModal.lead.followUpStage || 0) > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
                Stage {(pitchModal.lead.followUpStage || 0) + 1} of 4 · Next follow-up auto-schedules on send
              </div>
            )}
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
              <button className="btn btn-secondary" onClick={() => handleMarkSentOther(pitchModal.lead)}>
                Mark Sent (other)
              </button>
              <button className="btn btn-primary" onClick={() => handleSequenceSend(pitchModal.lead)}>
                <GmailIcon /> Open in Gmail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotesModal({ lead, onClose, onSave }) {
  const [notes, setNotes] = useState(lead.notes || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateLead(lead.id, { notes });
      onSave(updated);
    } catch { onClose(); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="modal-title" style={{ margin: 0 }}>Notes</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{lead.name}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <textarea className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Call notes, follow-up reminders, anything relevant…"
          style={{ width: '100%', minHeight: 140, resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}
          autoFocus />
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditLeadModal({ lead, onClose, onSave }) {
  const [form, setForm] = useState({
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    website: lead.website || '',
    city: lead.city || '',
    state: lead.state || '',
    vertical: lead.vertical || '',
  });
  const [saving, setSaving] = useState(false);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateLead(lead.id, form);
      onSave(updated);
    } catch { onClose(); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="modal-title" style={{ margin: 0 }}>Edit Lead</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="modal-field">
            <label>Business Name</label>
            <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="modal-field">
              <label>Phone</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
            </div>
            <div className="modal-field">
              <label>Email</label>
              <input className="form-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@business.com" />
            </div>
          </div>
          <div className="modal-field">
            <label>Website</label>
            <input className="form-input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div className="modal-field">
              <label>City</label>
              <input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="modal-field">
              <label>State</label>
              <input className="form-input" value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} style={{ textTransform: 'uppercase' }} />
            </div>
          </div>
          <div className="modal-field">
            <label>Vertical / Industry</label>
            <input className="form-input" value={form.vertical} onChange={e => set('vertical', e.target.value)} placeholder="e.g. plumbing, roofing, hvac" />
          </div>
        </div>
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EnrichIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>; }
function NotesIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>; }
function DownloadIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function UploadIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>; }
function EmailIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function SendIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>; }
function TrashIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>; }
function EmptyIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function GmailIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>; }
function PencilIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
