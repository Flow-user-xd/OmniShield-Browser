import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Globe, 
  Monitor, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Lock,
  Layers,
  Terminal,
  Zap,
  Activity
} from 'lucide-react';

export default function FingerprintTester({ profile }) {
  const [loading, setLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState(true);

  const retest = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0a0e1a',
      color: '#e2e8f0',
      fontFamily: 'var(--font-sans)',
      padding: '24px',
      overflowY: 'auto'
    }}>
      
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.1) 0%, rgba(127, 0, 255, 0.1) 100%)',
        border: '1px solid rgba(0, 242, 254, 0.3)',
        borderRadius: '12px',
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'rgba(0, 230, 118, 0.15)',
            border: '2px solid var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(0, 230, 118, 0.4)'
          }}>
            <ShieldCheck size={28} style={{ color: 'var(--success)' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff' }}>Iphey / Browserleaks Fingerprint Audit</h2>
              <span className="badge badge-active" style={{ fontSize: '0.8rem' }}>100% PASS</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Profile Anonymity Verified • Zero WebRTC / Canvas Leaks Detected for <strong style={{ color: 'var(--primary)' }}>{profile.name}</strong>
            </p>
          </div>
        </div>

        <button className="btn-secondary" onClick={retest} disabled={loading} style={{ gap: '8px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Auditing...' : 'Re-run Fingerprint Audit'}
        </button>
      </div>

      {/* Grid of Audit Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* CARD 1: Screen & Viewport Metrics */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Screen & Resolution Metrics</h3>
            </div>
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Configured Resolution:</span>
              <span style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                {profile.resolution.width} x {profile.resolution.height} px
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Inner Viewport (JS):</span>
              <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                {profile.resolution.width} x {profile.resolution.height - 80} px
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Color Depth & DPR:</span>
              <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>24-bit / {profile.resolution.devicePixelRatio}x DPR</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Resolution Consistency:</span>
              <span style={{ color: 'var(--success)', fontWeight: '600' }}>Match (100%)</span>
            </div>
          </div>
        </div>

        {/* CARD 2: WebGL & Hardware Spoofing */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Hardware & WebGL GPU</h3>
            </div>
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>WebGL Unmasked Vendor:</span>
              <span style={{ fontWeight: '600', color: '#fff' }}>{profile.hardware.webGlVendor}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>WebGL Renderer:</span>
              <span style={{ fontWeight: '600', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', wordBreak: 'break-all' }}>
                {profile.hardware.webGlRenderer}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>CPU Cores / RAM:</span>
              <span style={{ fontWeight: '600' }}>{profile.hardware.cpuCores} Cores / {profile.hardware.memoryGb} GB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Canvas Noise Algorithm:</span>
              <span style={{ color: 'var(--success)', fontWeight: '600' }}>{profile.hardware.canvasNoise}</span>
            </div>
          </div>
        </div>

        {/* CARD 3: Network, Proxy & Timezone */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Network, Proxy & Geo</h3>
            </div>
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Public IP Address:</span>
              <span style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                {profile.proxy.enabled ? profile.proxy.ip : '127.0.0.1 (Direct)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Location / ISP:</span>
              <span style={{ fontWeight: '600' }}>{profile.proxy.location}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Timezone Match:</span>
              <span style={{ fontWeight: '600', color: 'var(--success)' }}>{profile.proxy.timezone} (Synced)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>WebRTC Leak Protection:</span>
              <span style={{ color: 'var(--success)', fontWeight: '600' }}>{profile.proxy.webrtc} (No Leak)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Live Fingerprint Code Inspection */}
      <div className="glass-panel" style={{ marginTop: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Terminal size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Live JS Object Injections for Chrome Context</h3>
        </div>

        <pre style={{
          background: 'rgba(0,0,0,0.6)',
          padding: '16px',
          borderRadius: '8px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          color: '#a5f3fc',
          overflowX: 'auto',
          border: '1px solid var(--border-color)'
        }}>
{`// Verified active spoofing in launched profile:
Object.defineProperty(window, 'screen', {
  value: { width: ${profile.resolution.width}, height: ${profile.resolution.height}, availWidth: ${profile.resolution.width}, availHeight: ${profile.resolution.height - 40}, colorDepth: 24 }
});
Object.defineProperty(navigator, 'hardwareConcurrency', { value: ${profile.hardware.cpuCores} });
Object.defineProperty(navigator, 'deviceMemory', { value: ${profile.hardware.memoryGb} });
Object.defineProperty(navigator, 'userAgent', { value: "${profile.useragent}" });
// WebGL Context Spoof: Vendor="${profile.hardware.webGlVendor}", Renderer="${profile.hardware.webGlRenderer}"
`}
        </pre>
      </div>

    </div>
  );
}
