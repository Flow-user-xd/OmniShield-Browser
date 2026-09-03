import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Monitor, 
  Globe, 
  Cpu, 
  Layers, 
  Sliders, 
  Plus, 
  Terminal, 
  Settings, 
  Sparkles, 
  Activity, 
  HelpCircle,
  Folder,
  Download,
  Upload
} from 'lucide-react';

import { INITIAL_PROFILES } from './data/defaultProfiles';
import ProfileList from './components/ProfileList';
import ProfileModal from './components/ProfileModal';
import VirtualBrowserWindow from './components/VirtualBrowserWindow';
import CliExporterModal from './components/CliExporterModal';
import ProxyManager from './components/ProxyManager';

export default function App() {
  const [profiles, setProfiles] = useState(() => {
    const saved = localStorage.getItem('omnishield_profiles');
    return saved ? JSON.parse(saved) : INITIAL_PROFILES;
  });

  const [currentNav, setCurrentNav] = useState('profiles'); // 'profiles' | 'proxies' | 'settings'
  const [activeRunningId, setActiveRunningId] = useState(null);
  const [launchingProfile, setLaunchingProfile] = useState(null);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [cliExportProfile, setCliExportProfile] = useState(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('omnishield_profiles', JSON.stringify(profiles));
  }, [profiles]);

  // Profile Handlers
  const handleLaunchProfile = (profile) => {
    setActiveRunningId(profile.id);
    setLaunchingProfile(profile);
  };

  const handleStopProfile = (id) => {
    if (activeRunningId === id) {
      setActiveRunningId(null);
      setLaunchingProfile(null);
    }
  };

  const handleSaveProfile = (formData) => {
    if (editingProfile) {
      // Update existing
      setProfiles(profiles.map(p => p.id === formData.id ? formData : p));
    } else {
      // Create new
      setProfiles([formData, ...profiles]);
    }
    setIsCreateModalOpen(false);
    setEditingProfile(null);
  };

  const handleCloneProfile = (profile) => {
    const cloned = {
      ...profile,
      id: `prof-${Date.now()}`,
      name: `${profile.name} (Copy)`,
      status: 'stopped'
    };
    setProfiles([cloned, ...profiles]);
  };

  const handleDeleteProfile = (id) => {
    setProfiles(profiles.filter(p => p.id !== id));
    if (activeRunningId === id) {
      handleStopProfile(id);
    }
  };

  const handleOpenEdit = (profile) => {
    setEditingProfile(profile);
    setIsCreateModalOpen(true);
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profiles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `omnishield_profiles_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', background: 'var(--bg-dark)' }}>
      
      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        background: '#070b14',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 16px',
        userSelect: 'none'
      }}>
        <div>
          {/* Logo Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px 24px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00f2fe 0%, #7f00ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px var(--primary-glow)'
            }}>
              <Shield size={22} style={{ color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '-0.5px' }} className="gradient-text">
                OmniShield
              </h1>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>
                Anti-Detect Studio
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { id: 'profiles', label: 'Profiles Directory', icon: Monitor, badge: profiles.length },
              { id: 'proxies', label: 'Proxy Manager', icon: Globe, badge: '4 IPs' },
              { id: 'settings', label: 'Global Specs & Noise', icon: Settings }
            ].map(item => {
              const Icon = item.icon;
              const active = currentNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentNav(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: active ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: active ? '700' : '500',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: active ? 'rgba(0,242,254,0.2)' : 'rgba(255,255,255,0.06)', borderRadius: '10px', color: active ? 'var(--primary)' : 'var(--text-dim)' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Backup Tools & Active Indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          
          <button className="btn-secondary" style={{ width: '100%', fontSize: '0.8rem', justifyContent: 'center' }} onClick={handleExportJson}>
            <Download size={14} /> Export Backup JSON
          </button>

          <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status Engine</span>
              <span className="badge badge-active" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>ONLINE</span>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>Chrome CDP Engine v126</div>
          </div>
        </div>

      </aside>

      {/* Main Content Viewport Area */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        
        {/* Header Title Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff' }}>
              {currentNav === 'profiles' && 'Virtual Browser Profiles'}
              {currentNav === 'proxies' && 'Proxy Pools & Network Manager'}
              {currentNav === 'settings' && 'Global Anti-Detect Fingerprint Engine'}
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {currentNav === 'profiles' && 'Configure isolated Chrome browser environments with unique resolution viewports and WebGL noise.'}
              {currentNav === 'proxies' && 'Manage SOCKS5/HTTP proxies with latency monitoring and automatic WebRTC leak prevention.'}
              {currentNav === 'settings' && 'Fine-tune global Canvas noise algorithms, WebGL GPU parameters, and fonts spoofing.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn-secondary" onClick={() => { setEditingProfile(null); setIsCreateModalOpen(true); }}>
              <Plus size={16} /> Quick New Profile
            </button>
          </div>
        </header>

        {/* View Router */}
        {currentNav === 'profiles' && (
          <ProfileList 
            profiles={profiles}
            onLaunchProfile={handleLaunchProfile}
            onStopProfile={handleStopProfile}
            onEditProfile={handleOpenEdit}
            onCloneProfile={handleCloneProfile}
            onDeleteProfile={handleDeleteProfile}
            onOpenCreateModal={() => { setEditingProfile(null); setIsCreateModalOpen(true); }}
            onOpenCliExport={(prof) => setCliExportProfile(prof)}
            activeRunningId={activeRunningId}
          />
        )}

        {currentNav === 'proxies' && (
          <ProxyManager profiles={profiles} />
        )}

        {currentNav === 'settings' && (
          <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={20} /> Fingerprint Engine System Defaults
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Canvas Noise Injection Mode</label>
                <select className="select-field">
                  <option>Noise Offset (Recommended for Ads & E-commerce)</option>
                  <option>Block Canvas Readback</option>
                  <option>Native GPU Output</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>WebRTC Leak Protection Protocol</label>
                <select className="select-field">
                  <option>Proxy IP Relay (Prevents real IP leak)</option>
                  <option>Disable WebRTC Completely</option>
                </select>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Modals & Active Windows Overlays */}
      <ProfileModal 
        isOpen={isCreateModalOpen}
        editingProfile={editingProfile}
        onClose={() => { setIsCreateModalOpen(false); setEditingProfile(null); }}
        onSave={handleSaveProfile}
      />

      {launchingProfile && (
        <VirtualBrowserWindow 
          profile={launchingProfile}
          onClose={() => {
            handleStopProfile(launchingProfile.id);
          }}
          onOpenCliExport={(prof) => setCliExportProfile(prof)}
        />
      )}

      {cliExportProfile && (
        <CliExporterModal 
          profile={cliExportProfile}
          isOpen={!!cliExportProfile}
          onClose={() => setCliExportProfile(null)}
        />
      )}

    </div>
  );
}
