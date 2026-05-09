import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { isLocalMode } from '../utils/localStore';

const IS_PROD = !!import.meta.env.VITE_API_URL;

export default function Settings() {
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);

  async function checkBackend() {
    setChecking(true);
    try {
      const h = await api.health();
      setHealth(h.status === 'ok' ? 'connected' : 'error');
    } catch {
      setHealth('error');
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { checkBackend(); }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-sub">Configuration and deployment guide</div>
      </div>

      {/* Backend status */}
      <div className="card mb-20">
        <div className="section-title" style={{ marginBottom: '12px' }}>Backend Connection</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 14px', borderRadius: '5px',
            background: health === 'connected' ? 'rgba(29,185,84,0.1)' : health === 'error' ? 'rgba(224,60,60,0.1)' : 'var(--bg)',
            border: `1px solid ${health === 'connected' ? 'rgba(29,185,84,0.3)' : health === 'error' ? 'rgba(224,60,60,0.3)' : 'var(--border)'}`,
            color: health === 'connected' ? 'var(--green)' : health === 'error' ? 'var(--red)' : 'var(--text-muted)',
            fontSize: '13px', fontFamily: 'var(--font-mono)'
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            {health === 'connected' ? 'Backend connected' : health === 'error' ? 'Backend not reachable' : 'Checking...'}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={checkBackend} disabled={checking}>
            {checking ? <span className="spinner" /> : 'Recheck'}
          </button>
        </div>
        {health === 'error' && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="alert alert-info" style={{ fontSize: '12px' }}>
              <span>✅</span>
              <span><strong>Local mode is active</strong> — the app is fully functional. Leads, imports, and status updates are saved in your browser's localStorage.</span>
            </div>
            <div className="alert alert-warning" style={{ fontSize: '12px' }}>
              <span>⚠️</span>
              <div>
                {IS_PROD
                  ? <>Backend not reachable at <code style={{ fontFamily: 'var(--font-mono)' }}>{import.meta.env.VITE_API_URL}</code>. Deploy the backend to Railway and make sure it's running.</>
                  : <>Backend not running locally. Start it with <code style={{ fontFamily: 'var(--font-mono)' }}>cd backend && node src/index.js</code>, or deploy to Railway for production.</>
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Google Places API */}
      <div className="card mb-20">
        <div className="section-title" style={{ marginBottom: '12px' }}>Google Places API Setup</div>
        <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">console.cloud.google.com</a></li>
          <li>Create or select a project</li>
          <li>Enable <strong style={{ color: 'var(--text)' }}>Places API</strong> and <strong style={{ color: 'var(--text)' }}>Places API (New)</strong></li>
          <li>Create an API key under Credentials</li>
          <li>Add <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>GOOGLE_PLACES_API_KEY=your_key</code> to <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>backend/.env</code></li>
          <li>Restrict the key to the Places API for security</li>
        </ol>
      </div>

      {/* Email finder */}
      <div className="card mb-20">
        <div className="section-title" style={{ marginBottom: '12px' }}>Email Finder — How It Works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { step: '1', label: 'Scrape business website', desc: 'Hits homepage, /contact, /contact-us, /about, /about-us — extracts email addresses from page content and mailto links.' },
            { step: '2', label: 'Facebook About page', desc: 'Searches Google for their Facebook page, then scrapes the About tab for contact info.' },
            { step: '3', label: 'Pattern fallback', desc: 'Generates pattern guesses: info@domain.com, contact@domain.com, service@domain.com, etc.' }
          ].map(({ step, label, desc }) => (
            <div key={step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{step}</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment */}
      <div className="card mb-20">
        <div className="section-title" style={{ marginBottom: '12px' }}>Deployment Guide</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          <div>
            <div style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px', marginBottom: '6px' }}>FRONTEND → Vercel</div>
            <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Root: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>frontend/</code></li>
              <li>Build: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>npm run build</code></li>
              <li>Output: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>dist/</code></li>
              <li>Env: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>VITE_API_URL=https://your-railway-url.up.railway.app/api</code></li>
              <li>Env: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>VITE_CALCULATOR_URL=https://your-vercel-url/lsa-calculator.html</code></li>
            </ul>
          </div>
          <div>
            <div style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px', marginBottom: '6px' }}>BACKEND → Railway</div>
            <ul style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Root: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>backend/</code></li>
              <li>Start: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>node src/index.js</code></li>
              <li>Env: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>GOOGLE_PLACES_API_KEY</code>, <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>FRONTEND_URL</code>, <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>PORT=3001</code></li>
            </ul>
          </div>
          <div>
            <div style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '12px', marginBottom: '6px' }}>FUTURE → Supabase</div>
            <p style={{ fontSize: '12px' }}>The in-memory store in <code style={{ fontFamily: 'var(--font-mono)' }}>backend/src/services/store.js</code> is designed for a clean swap to Supabase — just replace the store methods with Supabase client calls.</p>
          </div>
        </div>
      </div>

      {/* ROI Calculator */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: '12px' }}>Public ROI Calculator</div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          The standalone LSA ROI calculator lives at <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>frontend/public/lsa-calculator.html</code> and is served automatically by Vercel at <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>/lsa-calculator.html</code>.
        </p>
        <a href="/lsa-calculator.html" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
          Open Calculator ↗
        </a>
      </div>
    </div>
  );
}
