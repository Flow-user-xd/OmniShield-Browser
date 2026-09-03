import React, { useState } from 'react';
import { 
  X, 
  Minus, 
  Square, 
  Maximize2, 
  RotateCcw, 
  ArrowLeft, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  Sliders, 
  Terminal, 
  Code, 
  Globe, 
  Smartphone, 
  Monitor,
  ExternalLink
} from 'lucide-react';
import FingerprintTester from './FingerprintTester';

export default function VirtualBrowserWindow({ profile, onClose, onOpenCliExport }) {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'demo-store' | 'ip-check' | 'custom'
  const [urlInput, setUrlInput] = useState('https://browserleaks.com/canvas');
  const [showDevTools, setShowDevTools] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Compute scaled dimensions to fit desktop screen gracefully while respecting profile aspect ratio & resolution
  const profileWidth = profile.resolution.width;
  const profileHeight = profile.resolution.height;
  
  // Calculate viewport ratio
  const isMobile = profileWidth < 600;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMinimized ? '0' : '20px'
    }}>
      
      {/* Chrome Window Wrapper respecting Profile Resolution */}
      <div 
        className="glass-panel"
        style={{
          width: isMobile ? '420px' : '92vw',
          height: isMobile ? '880px' : '88vh',
          maxWidth: '1600px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px var(--primary-glow)',
          border: '1px solid var(--border-highlight)',
          borderRadius: '12px',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
      >
        
        {/* Top Window Titlebar (Chrome Style) */}
        <div style={{
          background: '#0d1322',
          borderBottom: '1px solid var(--border-color)',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none'
        }}>
          
          {/* Chrome Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', flex: 1 }}>
            
            {/* Tab 1: Fingerprint Audit */}
            <div 
              onClick={() => { setActiveTab('audit'); setUrlInput('https://iphey.com/audit'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px 8px 0 0',
                background: activeTab === 'audit' ? '#141d33' : 'transparent',
                border: activeTab === 'audit' ? '1px solid var(--border-color)' : '1px solid transparent',
                borderBottom: 'none',
                color: activeTab === 'audit' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}
            >
              <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
              <span>Iphey Anonymity Audit</span>
              <span style={{ fontSize: '0.65rem', background: 'rgba(0,230,118,0.2)', color: 'var(--success)', padding: '1px 5px', borderRadius: '4px' }}>100%</span>
            </div>

            {/* Tab 2: Web App Demo */}
            <div 
              onClick={() => { setActiveTab('demo-store'); setUrlInput('https://amazon.com/seller-central'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px 8px 0 0',
                background: activeTab === 'demo-store' ? '#141d33' : 'transparent',
                border: activeTab === 'demo-store' ? '1px solid var(--border-color)' : '1px solid transparent',
                borderBottom: 'none',
                color: activeTab === 'demo-store' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}
            >
              <Globe size={14} style={{ color: 'var(--primary)' }} />
              <span>Target Website Session</span>
            </div>
          </div>

          {/* Profile Specs Badge & Window Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,242,254,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(0,242,254,0.2)' }}>
              {isMobile ? <Smartphone size={14} style={{ color: 'var(--primary)' }} /> : <Monitor size={14} style={{ color: 'var(--primary)' }} />}
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: '700' }}>
                {profileWidth}x{profileHeight} ({profile.os})
              </span>
            </div>

            <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => onOpenCliExport(profile)}>
              <Terminal size={13} /> Export Chrome CLI
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <button 
                onClick={onClose} 
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#ff5f56',
                  border: 'none',
                  cursor: 'pointer'
                }} 
                title="Close Virtual Chrome Instance"
              />
            </div>
          </div>

        </div>

        {/* Chrome Navigation Bar */}
        <div style={{
          background: '#141d33',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
            <ArrowLeft size={16} style={{ cursor: 'pointer' }} />
            <ArrowRight size={16} style={{ cursor: 'pointer' }} />
            <RotateCcw size={15} style={{ cursor: 'pointer' }} />
          </div>

          {/* Chrome URL Address Bar */}
          <div style={{
            flex: 1,
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)'
          }}>
            <Lock size={13} style={{ color: 'var(--success)' }} />
            <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>https://</span>
            <input 
              type="text" 
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                width: '100%',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Chrome DevTools Toggle */}
          <button 
            className="btn-secondary" 
            style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: showDevTools ? 'var(--primary)' : 'var(--border-color)' }}
            onClick={() => setShowDevTools(!showDevTools)}
          >
            <Code size={14} /> DevTools
          </button>
        </div>

        {/* Browser Content Viewport & Devtools Split Pane */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          
          {/* Main Viewport Content */}
          <div style={{ flex: 1, height: '100%', overflow: 'hidden', background: '#090d16' }}>
            {activeTab === 'audit' && (
              <FingerprintTester profile={profile} />
            )}

            {activeTab === 'demo-store' && (
              <div style={{ padding: '40px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '16px' }}>
                <Globe size={48} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700' }}>Isolated E-Commerce Session Simulator</h2>
                <p style={{ maxWidth: '500px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  This browser tab is running with isolated Cookies ({profile.storage.cookiesCount} saved), LocalStorage, and Proxy IP <strong style={{ color: 'var(--primary)' }}>{profile.proxy.ip}</strong>.
                </p>
                <div className="glass-panel" style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                  <div>Cookie Store ID: <code>cookie-store-{profile.id}</code></div>
                  <div>User-Agent: <code>{profile.useragent.slice(0, 50)}...</code></div>
                  <div>Resolution: <code>{profileWidth}x{profileHeight}</code></div>
                </div>
              </div>
            )}
          </div>

          {/* DevTools Drawer Side Panel */}
          {showDevTools && (
            <div style={{
              width: '380px',
              height: '100%',
              background: '#0a0d14',
              borderLeft: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem'
            }}>
              <div style={{ padding: '10px 14px', background: '#121824', borderBottom: '1px solid var(--border-color)', fontWeight: '700', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Chrome CDP Overrides</span>
                <X size={14} style={{ cursor: 'pointer' }} onClick={() => setShowDevTools(false)} />
              </div>
              <div style={{ padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', color: '#cbd5e1' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>// Emulated Screen Metrics:</span>
                  <div style={{ color: '#38bdf8' }}>
                    Emulation.setDeviceMetricsOverride({`{\n  width: ${profileWidth},\n  height: ${profileHeight},\n  deviceScaleFactor: ${profile.resolution.devicePixelRatio},\n  mobile: ${isMobile}\n}`})
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>// WebGL Vendor Spoof:</span>
                  <div style={{ color: '#4ade80' }}>
                    GL.getParameter(UNMASKED_VENDOR_WEBGL): "{profile.hardware.webGlVendor}"
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>// Timezone Override:</span>
                  <div style={{ color: '#f43f5e' }}>
                    Emulation.setTimezoneOverride({`{ timezoneId: "${profile.proxy.timezone}" }`})
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
