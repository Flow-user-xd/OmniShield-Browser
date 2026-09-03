import React, { useState } from 'react';
import { Globe, Plus, Trash2, CheckCircle2, RefreshCw, AlertCircle, Shield, Radio, Search } from 'lucide-react';

export default function ProxyManager({ profiles }) {
  const [proxies, setProxies] = useState([
    { id: 'prx-1', type: 'SOCKS5', ip: '198.51.100.42', port: '1080', location: 'New York, US', latency: 45, status: 'Online', profileAssigned: 'Workstation Alpha - US East' },
    { id: 'prx-2', type: 'HTTP', ip: '185.220.101.5', port: '8080', location: 'Frankfurt, DE', latency: 110, status: 'Online', profileAssigned: 'MacBook Pro - EU Central' },
    { id: 'prx-3', type: 'HTTP', ip: '172.56.21.90', port: '8000', location: 'London, UK', latency: 85, status: 'Online', profileAssigned: 'iPhone 15 Mobile Profile' },
    { id: 'prx-4', type: 'SOCKS5', ip: '103.145.22.18', port: '1080', location: 'Tokyo, JP', latency: 180, status: 'Online', profileAssigned: 'Unassigned' }
  ]);

  const [testing, setTesting] = useState(false);
  const [newProxy, setNewProxy] = useState({ type: 'SOCKS5', ip: '', port: '1080', user: '', pass: '' });

  const testAllProxies = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
    }, 800);
  };

  const handleAddProxy = (e) => {
    e.preventDefault();
    if (!newProxy.ip) return;
    setProxies([
      ...proxies,
      {
        id: `prx-${Date.now()}`,
        type: newProxy.type,
        ip: newProxy.ip,
        port: newProxy.port || '8080',
        location: 'Detected IP Location',
        latency: Math.floor(Math.random() * 120 + 30),
        status: 'Online',
        profileAssigned: 'Unassigned'
      }
    ]);
    setNewProxy({ type: 'SOCKS5', ip: '', port: '1080', user: '', pass: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Proxy Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Globe size={32} style={{ color: 'var(--primary)' }} />
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Proxies Pool</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff' }}>{proxies.length}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Healthy Connections</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--success)' }}>100%</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Radio size={32} style={{ color: 'var(--accent-purple)' }} />
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avg Latency</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff' }}>82 ms</div>
          </div>
        </div>
      </div>

      {/* Add Proxy Form */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '14px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Quick Add Proxy Entry
        </h3>

        <form onSubmit={handleAddProxy} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 2fr auto', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Protocol</label>
            <select 
              className="select-field" 
              style={{ height: '38px', padding: '0 10px', fontSize: '0.85rem' }}
              value={newProxy.type}
              onChange={(e) => setNewProxy({ ...newProxy, type: e.target.value })}
            >
              <option value="SOCKS5">SOCKS5</option>
              <option value="HTTP">HTTP</option>
              <option value="HTTPS">HTTPS</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IP / Hostname</label>
            <input 
              type="text" 
              placeholder="e.g. 198.51.100.42"
              className="input-field"
              style={{ height: '38px', fontSize: '0.85rem' }}
              value={newProxy.ip}
              onChange={(e) => setNewProxy({ ...newProxy, ip: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Port</label>
            <input 
              type="text" 
              placeholder="1080"
              className="input-field"
              style={{ height: '38px', fontSize: '0.85rem' }}
              value={newProxy.port}
              onChange={(e) => setNewProxy({ ...newProxy, port: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auth (User:Pass Optional)</label>
            <input 
              type="text" 
              placeholder="username:password"
              className="input-field"
              style={{ height: '38px', fontSize: '0.85rem' }}
              value={newProxy.user}
              onChange={(e) => setNewProxy({ ...newProxy, user: e.target.value })}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ height: '38px', padding: '0 18px', fontSize: '0.85rem' }}>
            Add Proxy
          </button>
        </form>
      </div>

      {/* Proxy List Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Configured Proxy Pools</h3>
          <button className="btn-secondary" onClick={testAllProxies} disabled={testing} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <RefreshCw size={14} className={testing ? 'spin' : ''} /> Test All Speed & Latency
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Protocol & IP</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Location</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Latency</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Assigned Profile</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {proxies.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                  <span style={{ color: 'var(--primary)', marginRight: '8px' }}>[{p.type}]</span>
                  {p.ip}:{p.port}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{p.location}</td>
                <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: p.latency < 100 ? 'var(--success)' : 'var(--warning)' }}>
                  {p.latency} ms
                </td>
                <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {p.profileAssigned}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button 
                    className="btn-danger" 
                    style={{ padding: '4px 8px' }}
                    onClick={() => setProxies(proxies.filter(item => item.id !== p.id))}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
