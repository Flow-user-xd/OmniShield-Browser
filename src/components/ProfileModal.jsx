import React, { useState, useEffect } from 'react';
import { 
  X, 
  Monitor, 
  Cpu, 
  Globe, 
  ShieldCheck, 
  HardDrive, 
  Sparkles, 
  Sliders, 
  Database,
  RefreshCw,
  MapPin,
  Clock,
  Radio
} from 'lucide-react';
import { RESOLUTION_PRESETS, GPU_VENDOR_RENDERERS } from '../data/defaultProfiles';

export default function ProfileModal({ isOpen, onClose, onSave, editingProfile }) {
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'resolution' | 'hardware' | 'proxy' | 'cookies'

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    group: 'General',
    tags: [],
    tagInput: '',
    os: 'Windows 11',
    browser: 'Chrome 126',
    useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    resolution: {
      preset: '1920x1080',
      width: 1920,
      height: 1080,
      devicePixelRatio: 1
    },
    hardware: {
      cpuCores: 8,
      memoryGb: 16,
      webGlVendor: 'Google Inc. (NVIDIA)',
      webGlRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
      canvasNoise: 'Noise (Hash offset)',
      audioNoise: 'Enabled (+0.00001db)',
      fonts: ['Arial', 'Calibri', 'Segoe UI', 'Times New Roman']
    },
    proxy: {
      enabled: true,
      type: 'SOCKS5',
      ip: '198.51.100.42',
      port: '1080',
      username: '',
      password: '',
      location: 'New York, US',
      timezone: 'America/New_York',
      lat: 40.7128,
      lng: -74.0060,
      webrtc: 'Proxy IP'
    },
    storage: {
      cookiesCount: 0,
      localStorageKeys: 0,
      rawCookiesJson: ''
    }
  });

  useEffect(() => {
    if (editingProfile) {
      setFormData({
        ...editingProfile,
        tagInput: '',
        storage: {
          ...editingProfile.storage,
          rawCookiesJson: JSON.stringify([
            { name: "session_id", value: "x9f8a7d6s5a4", domain: ".target.com", path: "/" }
          ], null, 2)
        }
      });
    } else {
      // Reset for new profile
      setFormData({
        id: `prof-${Date.now()}`,
        name: `Profile #${Math.floor(Math.random() * 9000 + 1000)}`,
        group: 'General',
        tags: ['New', 'Chrome'],
        tagInput: '',
        os: 'Windows 11',
        browser: 'Chrome 126',
        useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        resolution: { preset: '1920x1080', width: 1920, height: 1080, devicePixelRatio: 1 },
        hardware: {
          cpuCores: 8,
          memoryGb: 16,
          webGlVendor: 'Google Inc. (NVIDIA)',
          webGlRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
          canvasNoise: 'Noise (Hash offset)',
          audioNoise: 'Enabled',
          fonts: ['Arial', 'Calibri', 'Segoe UI']
        },
        proxy: {
          enabled: true,
          type: 'HTTP',
          ip: '104.28.14.92',
          port: '8080',
          username: '',
          password: '',
          location: 'San Jose, US',
          timezone: 'America/Los_Angeles',
          lat: 37.3382,
          lng: -121.8863,
          webrtc: 'Proxy IP'
        },
        storage: { cookiesCount: 1, localStorageKeys: 0, rawCookiesJson: '' }
      });
    }
  }, [editingProfile, isOpen]);

  if (!isOpen) return null;

  const handleResolutionPreset = (preset) => {
    setFormData({
      ...formData,
      resolution: {
        preset: preset.name,
        width: preset.width,
        height: preset.height,
        devicePixelRatio: preset.dpr
      }
    });
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && formData.tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(formData.tagInput.trim())) {
        setFormData({
          ...formData,
          tags: [...formData.tags, formData.tagInput.trim()],
          tagInput: ''
        });
      }
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tagToRemove)
    });
  };

  const generateRandomFingerprint = () => {
    const presets = window.DEVICE_PRESETS || [];
    if (presets.length > 0) {
      const item = presets[Math.floor(Math.random() * presets.length)];
      setFormData(prev => ({
        ...prev,
        os: item.os,
        useragent: item.useragent,
        resolution: {
          preset: `${item.resolution.width}x${item.resolution.height}`,
          width: item.resolution.width,
          height: item.resolution.height,
          devicePixelRatio: item.os.includes('iOS') || item.os.includes('macOS') ? 2 : 1
        },
        hardware: {
          ...prev.hardware,
          cpuCores: item.cpuCores,
          memoryGb: item.memoryGb,
          webGlVendor: item.webGlVendor,
          webGlRenderer: item.webGlRenderer
        }
      }));
    } else {
      const gpu = GPU_VENDOR_RENDERERS[Math.floor(Math.random() * GPU_VENDOR_RENDERERS.length)];
      const cores = [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)];
      const ram = [8, 16, 32, 64][Math.floor(Math.random() * 4)];

      setFormData(prev => ({
        ...prev,
        hardware: {
          ...prev.hardware,
          cpuCores: cores,
          memoryGb: ram,
          webGlVendor: gpu.vendor,
          webGlRenderer: gpu.renderer
        }
      }));
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
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
        overflow: 'hidden',
        border: '1px solid var(--border-highlight)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>
              {editingProfile ? 'Edit Profile Configuration' : 'Create Anti-Detect Browser Profile'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Bar Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.2)',
          padding: '0 24px',
          gap: '16px'
        }}>
          {[
            { id: 'general', label: 'General & OS', icon: Sliders },
            { id: 'resolution', label: 'Screen & Viewport', icon: Monitor },
            { id: 'hardware', label: 'Hardware & Canvas', icon: Cpu },
            { id: 'proxy', label: 'Proxy & Geolocation', icon: Globe },
            { id: 'cookies', label: 'Cookies & Storage', icon: Database }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 4px',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  color: active ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: active ? '700' : '500',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body / Tab Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* TAB 1: GENERAL & OS */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Profile Name</label>
                  <input 
                    type="text" 
                    className="input-field"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Group / Folder</label>
                  <input 
                    type="text" 
                    className="input-field"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Tags (Press Enter)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {formData.tags.map((t, idx) => (
                    <span key={idx} style={{ background: 'rgba(0,242,254,0.15)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      #{t}
                      <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(t)} />
                    </span>
                  ))}
                </div>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="Add a tag..."
                  value={formData.tagInput}
                  onChange={(e) => setFormData({ ...formData, tagInput: e.target.value })}
                  onKeyDown={handleAddTag}
                />
              </div>

              {/* OS Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Operating System Spoof</label>
                  <select 
                    className="select-field"
                    value={formData.os}
                    onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                  >
                    <option value="Windows 11">Windows 11 (x64)</option>
                    <option value="macOS Sonoma">macOS Sonoma (ARM/Intel)</option>
                    <option value="Linux Ubuntu">Linux Ubuntu (x64)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Target Browser Version</label>
                  <select 
                    className="select-field"
                    value={formData.browser}
                    onChange={(e) => setFormData({ ...formData, browser: e.target.value })}
                  >
                    <option value="Chrome 126">Google Chrome 126</option>
                    <option value="Chrome 125">Google Chrome 125</option>
                    <option value="Firefox 125">Mozilla Firefox 125</option>
                    <option value="Safari 17.2">Apple Safari 17.2</option>
                  </select>
                </div>
              </div>

              {/* User Agent String */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Full User-Agent String</label>
                <textarea 
                  className="input-field" 
                  rows="3" 
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                  value={formData.useragent}
                  onChange={(e) => setFormData({ ...formData, useragent: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* TAB 2: RESOLUTION & SCREEN */}
          {activeTab === 'resolution' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', display: 'block', marginBottom: '10px' }}>
                  Quick Resolution Presets
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                  {RESOLUTION_PRESETS.map((preset) => {
                    const isSelected = formData.resolution.width === preset.width && formData.resolution.height === preset.height;
                    return (
                      <div 
                        key={preset.name}
                        onClick={() => handleResolutionPreset(preset)}
                        className="glass-panel"
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                          background: isSelected ? 'rgba(0,242,254,0.08)' : 'rgba(0,0,0,0.2)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{preset.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                          Width: {preset.width}px | Height: {preset.height}px | DPR: {preset.dpr}x
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Resolution Controls */}
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)' }}>Custom Dimension Overrides</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Width (px)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={formData.resolution.width} 
                      onChange={(e) => setFormData({
                        ...formData,
                        resolution: { ...formData.resolution, width: parseInt(e.target.value) || 1280 }
                      })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Height (px)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={formData.resolution.height} 
                      onChange={(e) => setFormData({
                        ...formData,
                        resolution: { ...formData.resolution, height: parseInt(e.target.value) || 720 }
                      })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Device Pixel Ratio (DPR)</label>
                    <input 
                      type="number" 
                      step="0.25"
                      className="input-field" 
                      value={formData.resolution.devicePixelRatio} 
                      onChange={(e) => setFormData({
                        ...formData,
                        resolution: { ...formData.resolution, devicePixelRatio: parseFloat(e.target.value) || 1 }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HARDWARE & CANVAS */}
          {activeTab === 'hardware' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Hardware Spoofing Controls</span>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={generateRandomFingerprint}>
                  <Sparkles size={14} /> Randomize Hardware Noise
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>CPU Concurrency Cores</label>
                  <select 
                    className="select-field"
                    value={formData.hardware.cpuCores}
                    onChange={(e) => setFormData({ ...formData, hardware: { ...formData.hardware, cpuCores: parseInt(e.target.value) } })}
                  >
                    <option value={2}>2 Cores</option>
                    <option value={4}>4 Cores</option>
                    <option value={6}>6 Cores</option>
                    <option value={8}>8 Cores</option>
                    <option value={12}>12 Cores</option>
                    <option value={16}>16 Cores</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Device Memory (RAM GB)</label>
                  <select 
                    className="select-field"
                    value={formData.hardware.memoryGb}
                    onChange={(e) => setFormData({ ...formData, hardware: { ...formData.hardware, memoryGb: parseInt(e.target.value) } })}
                  >
                    <option value={4}>4 GB</option>
                    <option value={8}>8 GB</option>
                    <option value={16}>16 GB</option>
                    <option value={32}>32 GB</option>
                    <option value={64}>64 GB</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>WebGL Vendor & GPU Renderer</label>
                <select 
                  className="select-field"
                  value={formData.hardware.webGlRenderer}
                  onChange={(e) => {
                    const selectedGpu = GPU_VENDOR_RENDERERS.find(g => g.renderer === e.target.value);
                    if (selectedGpu) {
                      setFormData({
                        ...formData,
                        hardware: {
                          ...formData.hardware,
                          webGlVendor: selectedGpu.vendor,
                          webGlRenderer: selectedGpu.renderer
                        }
                      });
                    }
                  }}
                >
                  {GPU_VENDOR_RENDERERS.map(g => (
                    <option key={g.renderer} value={g.renderer}>{g.vendor} — {g.renderer}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Canvas Fingerprint Mode</label>
                  <select 
                    className="select-field"
                    value={formData.hardware.canvasNoise}
                    onChange={(e) => setFormData({ ...formData, hardware: { ...formData.hardware, canvasNoise: e.target.value } })}
                  >
                    <option value="Noise (Hash offset)">Noise (Recommended - Unique per profile)</option>
                    <option value="Off">Off (Use native GPU canvas)</option>
                    <option value="Block Noise">Block Canvas API</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>AudioContext Noise</label>
                  <select 
                    className="select-field"
                    value={formData.hardware.audioNoise}
                    onChange={(e) => setFormData({ ...formData, hardware: { ...formData.hardware, audioNoise: e.target.value } })}
                  >
                    <option value="Enabled (+0.00001db)">Enabled (+0.00001db Noise)</option>
                    <option value="Disabled">Disabled (Native Audio context)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROXY & GEOLOCATION */}
          {activeTab === 'proxy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Enable Network Proxy for Profile</span>
                <input 
                  type="checkbox" 
                  checked={formData.proxy.enabled}
                  onChange={(e) => setFormData({ ...formData, proxy: { ...formData.proxy, enabled: e.target.checked } })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {formData.proxy.enabled && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Protocol</label>
                      <select 
                        className="select-field"
                        value={formData.proxy.type}
                        onChange={(e) => setFormData({ ...formData, proxy: { ...formData.proxy, type: e.target.value } })}
                      >
                        <option value="HTTP">HTTP</option>
                        <option value="HTTPS">HTTPS</option>
                        <option value="SOCKS5">SOCKS5</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IP Address / Host</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={formData.proxy.ip} 
                        onChange={(e) => setFormData({ ...formData, proxy: { ...formData.proxy, ip: e.target.value } })}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Port</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={formData.proxy.port} 
                        onChange={(e) => setFormData({ ...formData, proxy: { ...formData.proxy, port: e.target.value } })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Timezone ID</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={formData.proxy.timezone} 
                        onChange={(e) => setFormData({ ...formData, proxy: { ...formData.proxy, timezone: e.target.value } })}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>WebRTC Handling</label>
                      <select 
                        className="select-field"
                        value={formData.proxy.webrtc}
                        onChange={(e) => setFormData({ ...formData, proxy: { ...formData.proxy, webrtc: e.target.value } })}
                      >
                        <option value="Proxy IP">Spoof Proxy IP (Recommended)</option>
                        <option value="Disabled">Disable WebRTC Completely</option>
                        <option value="Real IP">Expose Real IP</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 5: COOKIES & STORAGE */}
          {activeTab === 'cookies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Import JSON / Netscape Cookies
                </label>
                <textarea 
                  className="input-field"
                  rows="6"
                  placeholder='[ { "name": "auth_token", "value": "xyz...", "domain": ".example.com" } ]'
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                  value={formData.storage.rawCookiesJson}
                  onChange={(e) => setFormData({
                    ...formData,
                    storage: { ...formData.storage, rawCookiesJson: e.target.value }
                  })}
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.3)'
        }}>
          <button 
            type="button" 
            onClick={generateRandomFingerprint}
            className="btn-secondary" 
            style={{
              borderColor: '#7f00ff',
              color: '#00f2fe',
              background: 'rgba(127, 0, 255, 0.25)',
              fontWeight: '700',
              fontSize: '0.85rem',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={16} /> Randomize Fingerprint
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={() => onSave(formData)}>
              {editingProfile ? 'Save Profile Changes' : 'Create Profile'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
