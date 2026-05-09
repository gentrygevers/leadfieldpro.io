import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatMoney } from '../utils/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.getStats(), api.getSearchHistory()])
      .then(([s, h]) => { setStats(s); setHistory(h); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusColors = { New: 'var(--blue)', Researching: 'var(--accent)', Contacted: 'var(--green)', Replied: '#a78bfa', Qualified: '#f472b6', Closed: '#22c55e' };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">LSA gap intelligence overview</div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Leads" value={stats?.totalLeads ?? '—'} />
        <StatCard label="Emails Found" value={stats?.emailsFound ?? '—'} accent />
        <StatCard label="Emails Sent" value={stats?.emailsSent ?? '—'} green />
        <StatCard label="Missed Rev (total)" value={stats ? formatMoney(stats.totalMissedRevenue) : '—'} accent />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Pipeline breakdown */}
        <div className="card">
          <div className="section-row">
            <div className="section-title">Pipeline Status</div>
          </div>
          {stats?.statusCounts && Object.keys(stats.statusCounts).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(stats.statusCounts).map(([status, count]) => {
                const pct = Math.round((count / stats.totalLeads) * 100);
                return (
                  <div key={status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: statusColors[status] || 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{status}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                    </div>
                    <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: statusColors[status] || 'var(--border2)', borderRadius: '2px', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: 'var(--text-dim)', fontSize: '13px', paddingTop: '8px' }}>No leads yet. Run a search to get started.</div>
          )}
        </div>

        {/* Recent searches */}
        <div className="card">
          <div className="section-row">
            <div className="section-title">Recent Searches</div>
          </div>
          {history.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: '13px', paddingTop: '8px' }}>No searches yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {history.slice(0, 8).map((h) => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text)' }}>{h.city}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{h.vertical}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{h.resultCount} leads</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="section-title" style={{ marginBottom: '14px' }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => navigate('/find')}>
            <SearchIcon /> Search Market
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/crm')}>
            <ListIcon /> View CRM
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, green }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className={`card-value${accent ? ' accent' : green ? ' green' : ''}`}>{value}</div>
    </div>
  );
}
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
}
function ListIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
