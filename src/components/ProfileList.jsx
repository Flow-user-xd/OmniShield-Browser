import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  Edit3, 
  Copy, 
  Trash2, 
  Globe, 
  ShieldCheck, 
  Terminal, 
  Monitor, 
  Cpu, 
  HardDrive, 
  Filter, 
  Search, 
  Plus, 
  ExternalLink,
  MoreVertical,
  CheckSquare,
  Square as SquareIcon
} from 'lucide-react';

export default function ProfileList({ 
  profiles, 
  onLaunchProfile, 
  onStopProfile, 
  onEditProfile, 
  onCloneProfile, 
  onDeleteProfile, 
  onOpenCreateModal,
  onOpenCliExport,
  activeRunningId
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [selectedProfileIds, setSelectedProfileIds] = useState([]);

  // Extract unique groups
  const groups = ['ALL', ...new Set(profiles.map(p => p.group).filter(Boolean))];

  const filteredProfiles = profiles.filter(profile => {
    const ipStr = profile.proxy?.ip || '';
    const matchesSearch = profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          profile.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          ipStr.includes(searchQuery);
    const matchesGroup = selectedGroup === 'ALL' || profile.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const toggleSelectAll = () => {
    if (selectedProfileIds.length === filteredProfiles.length) {
      setSelectedProfileIds([]);
    } else {
      setSelectedProfileIds(filteredProfiles.map(p => p.id));
    }
  };

  const toggleSelectProfile = (id) => {
    if (selectedProfileIds.includes(id)) {
      setSelectedProfileIds(selectedProfileIds.filter(i => i !== id));
    } else {
      setSelectedProfileIds([...selectedProfileIds, id]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Action Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-primary" onClick={onOpenCreateModal}>
            <Plus size={18} /> Create New Profile
          </button>
          {selectedProfileIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {selectedProfileIds.length} Selected
              </span>
              <button 
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => selectedProfileIds.forEach(id => onLaunchProfile(profiles.find(p => p.id === id)))}
              >
                <Play size={14} /> Bulk Launch
              </button>
              <button 
                className="btn-danger"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => {
                  if (confirm(`Delete ${selectedProfileIds.length} selected profiles?`)) {
                    selectedProfileIds.forEach(id => onDeleteProfile(id));
                    setSelectedProfileIds([]);
                  }
                }}
              >
                <Trash2 size={14} /> Bulk Delete
              </button>
            </div>
          )}
        </div>

        {/* Search & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '500px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input 
              type="text" 
              placeholder="Search by profile name, tags, or proxy IP..."
              className="input-field"
              style={{ paddingLeft: '38px', height: '38px', fontSize: '0.85rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select 
              className="select-field" 
              style={{ height: '38px', padding: '0 12px', fontSize: '0.85rem', width: 'auto' }}
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              {groups.map(g => (
                <option key={g} value={g}>{g === 'ALL' ? 'All Folders' : g}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '14px 16px', width: '40px' }}>
                <button 
                  onClick={toggleSelectAll} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {selectedProfileIds.length > 0 && selectedProfileIds.length === filteredProfiles.length ? (
                    <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
                  ) : (
                    <SquareIcon size={18} />
                  )}
                </button>
              </th>
              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Profile Name & Tags</th>
              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Resolution & Specs</th>
              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>OS & User-Agent</th>
              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Proxy & Timezone</th>
              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No profiles found matching your search. Create one to get started!
                </td>
              </tr>
            ) : (
              filteredProfiles.map((profile) => {
                const isRunning = activeRunningId === profile.id;
                const isSelected = selectedProfileIds.includes(profile.id);

                return (
                  <tr 
                    key={profile.id}
                    style={{ 
                      borderBottom: '1px solid var(--border-color)',
                      background: isRunning ? 'rgba(0, 242, 254, 0.04)' : isSelected ? 'rgba(255,255,255,0.02)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Select Checkbox */}
                    <td style={{ padding: '14px 16px' }}>
                      <button 
                        onClick={() => toggleSelectProfile(profile.id)} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        {isSelected ? <CheckSquare size={18} style={{ color: 'var(--primary)' }} /> : <SquareIcon size={18} />}
                      </button>
                    </td>

                    {/* Name & Folder */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fff' }}>{profile.name}</span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                            {profile.group}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {profile.tags.map((t, idx) => (
                            <span key={idx} style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(0,242,254,0.08)', padding: '1px 6px', borderRadius: '3px' }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Resolution & Specs */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Monitor size={14} style={{ color: 'var(--primary)' }} />
                          <span className="resolution-badge">
                            {profile.resolution.width} x {profile.resolution.height}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', gap: '8px' }}>
                          <span><Cpu size={11} style={{ display: 'inline', marginRight: '3px' }} />{profile.hardware.cpuCores} Cores</span>
                          <span><HardDrive size={11} style={{ display: 'inline', marginRight: '3px' }} />{profile.hardware.memoryGb} GB RAM</span>
                        </div>
                      </div>
                    </td>

                    {/* OS & Browser */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>{profile.os}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{profile.browser}</span>
                      </div>
                    </td>

                    {/* Proxy */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {profile.proxy.enabled ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Globe size={13} style={{ color: 'var(--success)' }} />
                              <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                                {profile.proxy.ip}:{profile.proxy.port}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              {profile.proxy.location} ({profile.proxy.timezone})
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Direct / No Proxy</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      {isRunning ? (
                        <span className="badge badge-active">
                          <span className="pulse-dot"></span> Running
                        </span>
                      ) : (
                        <span className="badge badge-stopped">Stopped</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {isRunning ? (
                          <button 
                            className="btn-danger" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => onStopProfile(profile.id)}
                          >
                            <Square size={13} /> Stop
                          </button>
                        ) : (
                          <button 
                            className="btn-primary" 
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            onClick={() => onLaunchProfile(profile)}
                          >
                            <Play size={13} /> Launch
                          </button>
                        )}

                        <button 
                          className="btn-secondary" 
                          title="Export Chrome CLI Command"
                          style={{ padding: '6px 8px' }}
                          onClick={() => onOpenCliExport(profile)}
                        >
                          <Terminal size={14} />
                        </button>

                        <button 
                          className="btn-secondary" 
                          title="Edit Profile Parameters"
                          style={{ padding: '6px 8px' }}
                          onClick={() => onEditProfile(profile)}
                        >
                          <Edit3 size={14} />
                        </button>

                        <button 
                          className="btn-secondary" 
                          title="Clone Profile"
                          style={{ padding: '6px 8px' }}
                          onClick={() => onCloneProfile(profile)}
                        >
                          <Copy size={14} />
                        </button>

                        <button 
                          className="btn-secondary" 
                          title="Delete Profile"
                          style={{ padding: '6px 8px', color: 'var(--danger)' }}
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete profile "${profile.name}"?`)) {
                              onDeleteProfile(profile.id);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
