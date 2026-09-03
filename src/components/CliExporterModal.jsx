import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Code, ShieldCheck, ExternalLink, Play } from 'lucide-react';

export default function CliExporterModal({ profile, isOpen, onClose }) {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedJs, setCopiedJs] = useState(false);

  if (!isOpen || !profile) return null;

  const profileDirName = profile.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

  // Generated Windows CMD / PowerShell CLI Command for launching isolated Google Chrome
  const chromeCliCommand = `chrome.exe --user-data-dir="C:\\OmniShieldProfiles\\${profileDirName}" ` +
    `--window-size=${profile.resolution.width},${profile.resolution.height} ` +
    `--user-agent="${profile.useragent}" ` +
    (profile.proxy.enabled ? `--proxy-server="${profile.proxy.type.toLowerCase()}://${profile.proxy.ip}:${profile.proxy.port}" ` : '') +
    `--no-first-run --no-default-browser-check https://browserleaks.com/canvas`;

  // Generated Puppeteer Node.js Script with CDP overrides
  const puppeteerScript = `const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
    userDataDir: 'C:\\\\OmniShieldProfiles\\\\${profileDirName}',
    args: [
      '--window-size=${profile.resolution.width},${profile.resolution.height}',
      '--user-agent=${profile.useragent}',
      ${profile.proxy.enabled ? `'--proxy-server=${profile.proxy.type.toLowerCase()}://${profile.proxy.ip}:${profile.proxy.port}'` : ''}
    ]
  });

  const page = await browser.newPage();
  
  // Emulate Screen Metrics
  await page.emulateTimezone('${profile.proxy.timezone}');
  await page.setViewport({
    width: ${profile.resolution.width},
    height: ${profile.resolution.height},
    deviceScaleFactor: ${profile.resolution.devicePixelRatio}
  });

  await page.goto('https://iphey.com');
})();`;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'cmd') {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } else {
      setCopiedJs(true);
      setTimeout(() => setCopiedJs(false), 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 250,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Terminal size={20} style={{ color: 'var(--primary)' }} />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Local Chrome Profile Launcher & Exporter</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target Profile: <strong style={{ color: 'var(--primary)' }}>{profile.name}</strong> ({profile.resolution.width}x{profile.resolution.height})
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SECTION 1: 1-Click PowerShell / CMD Command */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={15} /> Option 1: Direct Chrome Windows CLI Command
              </span>
              <button 
                className="btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => copyToClipboard(chromeCliCommand, 'cmd')}
              >
                {copiedCmd ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                {copiedCmd ? 'Copied to Clipboard!' : 'Copy CLI Command'}
              </button>
            </div>

            <pre style={{
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid var(--border-color)',
              padding: '14px',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: '#38bdf8',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {chromeCliCommand}
            </pre>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '6px' }}>
              * Paste this command into Command Prompt or PowerShell to launch a standalone Google Chrome window with isolated cookies, screen resolution, proxy, and user-agent.
            </p>
          </div>

          {/* SECTION 2: Puppeteer Automation Code */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code size={15} /> Option 2: Puppeteer Node.js Script Generator
              </span>
              <button 
                className="btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => copyToClipboard(puppeteerScript, 'js')}
              >
                {copiedJs ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                {copiedJs ? 'Copied to Clipboard!' : 'Copy Script'}
              </button>
            </div>

            <pre style={{
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid var(--border-color)',
              padding: '14px',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: '#4ade80',
              overflowX: 'auto'
            }}>
              {puppeteerScript}
            </pre>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'rgba(0,0,0,0.3)'
        }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  );
}
