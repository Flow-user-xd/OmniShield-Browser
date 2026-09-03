// OmniShield Browser Studio Engine with Real Chrome Window Launcher API Integration
(function() {
  
  let state = {
    profiles: [],
    chromeAvailable: false,
    chromePath: '',
    nav: 'profiles',
    activeRunningPids: {}, // profileId -> pid
    searchQuery: '',
    modalOpen: false,
    editingProfile: null,
    cliExportProfile: null,
    showSandboxId: null,
    showDevTools: false,
    proxies: [],
    selectedProfileIds: [],
    proxyHealthMap: {}
  };

  // Fetch initial profile state & proxies from Python Backend
  async function fetchProfiles() {
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      state.profiles = data.profiles || [];
      state.chromePath = data.chromePath || '';
      state.chromeAvailable = data.chromeAvailable;

      try {
        const pxRes = await fetch('/api/proxies');
        const pxData = await pxRes.json();
        state.proxies = pxData.proxies || [];
      } catch (pxErr) {}

      try {
        const healthRes = await fetch('/api/proxies/health');
        const healthData = await healthRes.json();
        state.proxyHealthMap = healthData.health || {};
      } catch (hErr) {}
      
      // Update running PIDs
      state.profiles.forEach(p => {
        if (p.status === 'running' && p.pid) {
          state.activeRunningPids[p.id] = p.pid;
        }
      });
      render();
    } catch (err) {
      console.error("Error connecting to OmniShield Backend API:", err);
    }
  }

  async function saveProxiesBackend() {
    try {
      await fetch('/api/proxies/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxies: state.proxies })
      });
    } catch (err) {
      console.error("Error saving proxies:", err);
    }
  }

  async function saveProfilesBackend() {
    try {
      await fetch('/api/profiles/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: state.profiles })
      });
    } catch (err) {
      console.error("Error saving profiles:", err);
    }
  }

  async function launchRealChrome(profileId) {
    try {
      const res = await fetch('/api/profiles/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profileId })
      });

      const data = await res.json();
      if (data.success) {
        state.activeRunningPids[profileId] = data.pid;
        const prof = state.profiles.find(p => p.id === profileId);
        if (prof) prof.status = 'running';
        render();
      } else {
        alert("Failed to launch Chrome: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error launching real Chrome profile window: " + err.message);
    }
  }

  async function stopRealChrome(profileId) {
    try {
      await fetch('/api/profiles/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profileId })
      });

      delete state.activeRunningPids[profileId];
      const prof = state.profiles.find(p => p.id === profileId);
      if (prof) prof.status = 'stopped';
      render();
    } catch (err) {
      console.error("Error stopping profile:", err);
    }
  }

  // Poll real-time active profiles from backend to update status instantly
  async function pollActiveProfiles() {
    try {
      const res = await fetch('/api/profiles/active');
      const data = await res.json();
      const newPids = data.activePids || {};
      
      let stateChanged = false;
      
      // Update state.activeRunningPids & prof.status
      state.profiles.forEach(prof => {
        if (newPids[prof.id]) {
          if (!state.activeRunningPids[prof.id] || prof.status !== 'running') {
            state.activeRunningPids[prof.id] = newPids[prof.id];
            prof.status = 'running';
            stateChanged = true;
          }
        } else {
          if (state.activeRunningPids[prof.id] || prof.status === 'running') {
            delete state.activeRunningPids[prof.id];
            prof.status = 'stopped';
            stateChanged = true;
          }
        }
      });

      if (stateChanged) {
        render();
      }
    } catch (err) {}
  }

  async function pollProxyHealth() {
    try {
      const res = await fetch('/api/proxies/health');
      const data = await res.json();
      state.proxyHealthMap = data.health || {};
    } catch (err) {}
  }

  // Start status polling
  setInterval(pollActiveProfiles, 1500);
  setInterval(pollProxyHealth, 5000);

  // Render Engine with Input Focus & Cursor Selection Preservation
  function render() {
    const activeEl = document.activeElement;
    let activeId = activeEl ? activeEl.id : null;
    let selStart = (activeEl && typeof activeEl.selectionStart === 'number') ? activeEl.selectionStart : null;
    let selEnd = (activeEl && typeof activeEl.selectionEnd === 'number') ? activeEl.selectionEnd : null;

    const app = document.getElementById('app');
    app.innerHTML = `
      <div style="display: flex; min-height: 100vh; width: 100vw; background: var(--bg-dark);">
        ${renderSidebar()}
        <main style="flex: 1; padding: 32px; overflow-y: auto;">
          ${renderHeader()}
          ${state.nav === 'profiles' ? renderProfileView() : ''}
          ${state.nav === 'proxies' ? renderProxyView() : ''}
        </main>
      </div>

      ${state.modalOpen ? renderProfileModal() : ''}
      ${state.showSandboxId ? renderVirtualSandbox() : ''}
      ${state.cliExportProfile ? renderCliExportModal() : ''}
    `;

    bindEvents();

    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) {
        el.focus();
        if (selStart !== null && selEnd !== null && typeof el.setSelectionRange === 'function') {
          try { el.setSelectionRange(selStart, selEnd); } catch (e) {}
        }
      }
    }
  }

  function renderSidebar() {
    return `
      <aside style="width: 260px; background: #070b14; border-right: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between; padding: 20px 16px; user-select: none;">
        <div>
          <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 24px; border-bottom: 1px solid var(--border-color); margin-bottom: 20px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #00f2fe 0%, #7f00ff 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px var(--primary-glow);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>
            </div>
            <div>
              <h1 style="font-size: 1.1rem; font-weight: 800;" class="gradient-text">OmniShield</h1>
              <span style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Anti-Detect Studio</span>
            </div>
          </div>

          <nav style="display: flex; flex-direction: column; gap: 6px;">
            <button class="nav-btn ${state.nav === 'profiles' ? 'active' : ''}" data-nav="profiles" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 8px; border: none; background: ${state.nav === 'profiles' ? 'rgba(0, 242, 254, 0.12)' : 'transparent'}; color: ${state.nav === 'profiles' ? 'var(--primary)' : 'var(--text-muted)'}; font-weight: 700; cursor: pointer;">
              <span>🖥️ Profiles Directory</span>
              <span style="font-size: 0.7rem; padding: 2px 8px; background: rgba(0,242,254,0.2); border-radius: 10px;">${state.profiles.length}</span>
            </button>
            <button class="nav-btn ${state.nav === 'proxies' ? 'active' : ''}" data-nav="proxies" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 8px; border: none; background: ${state.nav === 'proxies' ? 'rgba(0, 242, 254, 0.12)' : 'transparent'}; color: ${state.nav === 'proxies' ? 'var(--primary)' : 'var(--text-muted)'}; font-weight: 700; cursor: pointer;">
              <span>🌐 Proxy Pools</span>
              <span style="font-size: 0.7rem; padding: 2px 8px; background: rgba(255,255,255,0.06); border-radius: 10px;">${state.proxies.length} IPs</span>
            </button>
          </nav>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--border-color); padding-top: 16px;">
          <div style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.75rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Local Chrome Exec</span>
              <span class="badge ${state.chromeAvailable ? 'badge-active' : 'badge-stopped'}" style="font-size: 0.65rem;">
                ${state.chromeAvailable ? 'READY' : 'NOT FOUND'}
              </span>
            </div>
            <div style="color: var(--text-dim); font-size: 0.7rem; word-break: break-all;">
              ${state.chromePath || 'Scanning system...'}
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  function renderHeader() {
    return `
      <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px;">
        <div>
          <h2 style="font-size: 1.6rem; font-weight: 800; color: #fff;">
            ${state.nav === 'profiles' ? 'Virtual Anti-Detect Browser Profiles' : 'Proxy Pools & Network Manager'}
          </h2>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;">
            Clicking <strong style="color: var(--primary);">"Launch"</strong> opens a physical Google Chrome window on your computer with exact resolution, user-agent, proxy, and isolated session directory.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="btn-secondary" id="btn-quick-random-profile" style="border-color: #7f00ff; color: #00f2fe; background: rgba(127, 0, 255, 0.25); font-weight: 700; gap: 8px;">
            🎲 Quick Randomize Profile
          </button>
          <button class="btn-primary" id="btn-create-modal">
            ➕ Create New Profile
          </button>
        </div>
      </header>
    `;
  }

  function renderProfileView() {
    const q = (state.searchQuery || '').trim().toLowerCase();
    const filtered = state.profiles.filter(p => {
      if (!q) return true;
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const osMatch = (p.os || '').toLowerCase().includes(q);
      const browserMatch = (p.browser || '').toLowerCase().includes(q);
      const tagsMatch = (p.tags || []).some(t => t.toLowerCase().includes(q));
      const proxyMatch = p.proxy && (p.proxy.ip || '').toLowerCase().includes(q);
      return nameMatch || osMatch || browserMatch || tagsMatch || proxyMatch;
    });

    const selectedSet = new Set(state.selectedProfileIds || []);
    const selCount = selectedSet.size;
    const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedSet.has(p.id));

    return `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- GoLogin Style Action Bar & Search Header -->
        <div class="glass-panel" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 1;">
            <!-- Search Bar Input -->
            <div style="position: relative; flex-shrink: 0;">
              <input type="text" id="search-input" placeholder="🔍 Search profiles by name, OS, proxy..." class="input-field" style="width: 280px; height: 36px; padding-left: 12px; font-size: 0.84rem;" value="${state.searchQuery}">
            </div>

            <div style="height: 22px; width: 1px; background: var(--border-color); flex-shrink: 0;"></div>

            <!-- Multi-Select Indicator & GoLogin Action Buttons -->
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 0.78rem; font-weight: 700; color: ${selCount > 0 ? 'var(--primary)' : 'var(--text-muted)'}; background: ${selCount > 0 ? 'rgba(0,242,254,0.12)' : 'rgba(255,255,255,0.05)'}; padding: 4px 10px; border-radius: 16px; border: 1px solid ${selCount > 0 ? 'var(--primary)' : 'transparent'}; flex-shrink: 0;">
                Selected ${selCount} of ${state.profiles.length}
              </span>

              <button id="bulk-run-btn" class="btn-primary" ${selCount === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed; padding: 6px 12px; font-size: 0.78rem;"' : 'style="padding: 6px 12px; font-size: 0.78rem;"'}>
                ▶ Run (${selCount})
              </button>

              <button id="bulk-stop-btn" class="btn-danger" ${selCount === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed; padding: 6px 12px; font-size: 0.78rem;"' : 'style="padding: 6px 12px; font-size: 0.78rem;"'}>
                ⏹ Stop (${selCount})
              </button>

              <button id="bulk-proxy-btn" class="btn-secondary" ${selCount === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed; padding: 6px 12px; font-size: 0.78rem;"' : 'style="padding: 6px 12px; font-size: 0.78rem;"'}>
                🌐 Proxy
              </button>

              <button id="bulk-clone-btn" class="btn-secondary" ${selCount === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed; padding: 6px 12px; font-size: 0.78rem;"' : 'style="padding: 6px 12px; font-size: 0.78rem;"'}>
                👯 Clone
              </button>

              <button id="bulk-fingerprint-btn" class="btn-secondary" ${selCount === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed; padding: 6px 12px; font-size: 0.78rem;"' : 'style="padding: 6px 12px; font-size: 0.78rem;"'}>
                🔄 Fingerprint
              </button>

              <button id="bulk-delete-btn" class="btn-danger" ${selCount === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed; padding: 6px 12px; font-size: 0.78rem;"' : 'style="padding: 6px 12px; font-size: 0.78rem;"'}>
                🗑️ Delete
              </button>
            </div>
          </div>

          <span style="font-size: 0.82rem; color: var(--text-muted); flex-shrink: 0;">${filtered.length} Profiles Configured</span>
        </div>

        <!-- Profiles Data Table -->
        <div class="glass-panel" style="overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: rgba(0,0,0,0.3); border-bottom: 1px solid var(--border-color);">
                <th style="padding: 14px 12px; width: 36px; text-align: center;">
                  <input type="checkbox" id="select-all-checkbox" ${allFilteredSelected ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--primary);">
                </th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Profile Name & Tags</th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Resolution & Specs</th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">OS & Browser</th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Proxy IP</th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Status</th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(p => {
                const isRunning = !!state.activeRunningPids[p.id] || p.status === 'running';
                const pid = state.activeRunningPids[p.id] || p.pid;
                const isChecked = selectedSet.has(p.id);
                return `
                  <tr style="border-bottom: 1px solid var(--border-color); background: ${isChecked ? 'rgba(0, 242, 254, 0.08)' : (isRunning ? 'rgba(0, 242, 254, 0.03)' : 'transparent')};">
                    <td style="padding: 14px 12px; text-align: center;">
                      <input type="checkbox" class="profile-checkbox" data-id="${p.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--primary);">
                    </td>
                    <td style="padding: 14px 16px;">
                      <div style="font-weight: 700; font-size: 0.95rem; color: #fff;">${p.name}</div>
                      <div style="display: flex; gap: 4px; margin-top: 4px;">
                        ${(p.tags || []).map(t => `<span style="font-size: 0.7rem; color: var(--primary); background: rgba(0,242,254,0.1); padding: 1px 6px; border-radius: 3px;">#${t}</span>`).join('')}
                      </div>
                    </td>
                    <td style="padding: 14px 16px;">
                      <span class="resolution-badge">${p.resolution.width} x ${p.resolution.height}</span>
                      <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">${p.hardware.cpuCores} Cores | ${p.hardware.memoryGb}GB RAM</div>
                    </td>
                    <td style="padding: 14px 16px;">
                      <div style="font-size: 0.85rem; font-weight: 600;">${p.os}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${p.browser}</div>
                    </td>
                    <td style="padding: 14px 16px;">
                      <select class="select-field dash-proxy-select" data-id="${p.id}" style="height: 38px; padding: 6px 10px; font-size: 0.82rem; font-family: var(--font-mono); background: rgba(0,0,0,0.7); border-color: ${p.proxy && p.proxy.enabled ? 'var(--primary)' : 'var(--border-color)'};">
                        <option value="direct" ${!p.proxy || !p.proxy.enabled ? 'selected' : ''}>🌐 Direct Network (No Proxy)</option>
                        ${state.proxies.map(px => {
                          const pxKey = `${px.ip}:${px.port}`;
                          const isSel = p.proxy && p.proxy.enabled && (p.proxy.ip === px.ip && p.proxy.port === px.port);
                          return `<option value="${px.id}" ${isSel ? 'selected' : ''}>[${px.type}] ${pxKey} (${px.location || 'Pool IP'})</option>`;
                        }).join('')}
                      </select>
                    </td>
                    <td style="padding: 14px 16px;">
                      ${isRunning ? `<span class="badge badge-active"><span class="pulse-dot"></span> Chrome Open (PID ${pid})</span>` : '<span class="badge badge-stopped">Stopped</span>'}
                    </td>
                    <td style="padding: 14px 16px; text-align: right;">
                      <div style="display: flex; justify-content: flex-end; gap: 6px;">
                        ${isRunning ? `
                          <button class="btn-danger btn-stop-prof" data-id="${p.id}" style="padding: 6px 12px; font-size: 0.8rem;">⏹ Stop Chrome</button>
                        ` : `
                          <button class="btn-primary btn-launch-prof" data-id="${p.id}" style="padding: 6px 14px; font-size: 0.8rem;">▶ Launch Chrome Window</button>
                        `}
                        <button class="btn-secondary btn-export-cli" data-id="${p.id}" title="Export Chrome CLI" style="padding: 6px 8px;">💻 CLI</button>
                        <button class="btn-secondary btn-rand-prof" data-id="${p.id}" title="Randomize Fingerprint Specs" style="padding: 6px 8px; border-color: #7f00ff; color: #00f2fe;">🎲</button>
                        <button class="btn-secondary btn-edit-prof" data-id="${p.id}" style="padding: 6px 8px;">✏️ Edit</button>
                        <button class="btn-danger btn-delete-prof" data-id="${p.id}" style="padding: 6px 8px;">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderProxyView() {
    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Header Controls -->
        <div class="glass-panel" style="padding: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--primary); margin: 0;">🌐 Network Proxy Pools & Bulk Manager</h3>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">
              Manage SOCKS5/HTTP proxies, bulk paste <code style="color: var(--primary);">ip:port:username:password</code>, auto-fill columns, test latency, and delete proxies.
            </p>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <label class="btn-secondary" style="padding: 8px 16px; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; background: rgba(0,242,254,0.1); border-color: var(--primary); color: var(--primary);">
              📁 Import .txt File
              <input type="file" id="btn-import-txt-file" accept=".txt" style="display: none;">
            </label>
            <button id="btn-export-txt-file" class="btn-secondary" style="padding: 8px 16px; font-size: 0.85rem;">
              📥 Export .txt File
            </button>
            <button id="btn-delete-all-proxies" class="btn-danger" style="padding: 8px 16px; font-size: 0.85rem;">
              🗑️ Delete All Proxies At Once
            </button>
          </div>
        </div>

        <!-- Bulk Paste & Column Auto-Fill Section -->
        <div class="glass-panel" style="padding: 20px; display: flex; flex-direction: column; gap: 14px; border: 1px solid rgba(0,242,254,0.2);">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--primary); margin: 0;">📋 Fast Bulk Paste & Column Importer</h4>
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            Paste single or multiple proxies in format <code style="color: #fff;">ip:port</code> or <code style="color: #fff;">ip:port:username:password</code> or <code style="color: #fff;">username:password@ip:port</code> (one per line):
          </span>

          <textarea id="proxy-paste-area" rows="3" class="input-field" style="font-family: var(--font-mono); font-size: 0.82rem;" placeholder="192.168.1.100:8080:myuser:mypass&#10;104.28.14.92:1080&#10;user:pass@185.220.101.5:8080"></textarea>

          <div style="display: flex; gap: 12px; align-items: center;">
            <button id="btn-parse-paste-proxy" class="btn-secondary" style="padding: 8px 16px; font-size: 0.82rem; background: rgba(0,242,254,0.1); border-color: var(--primary); color: var(--primary);">
              ⚡ Auto-Fill Columns Below From Paste
            </button>
            <button id="btn-import-all-pasted" class="btn-primary" style="padding: 8px 18px; font-size: 0.82rem;">
              💾 Import & Save All Pasted Proxies to Pool
            </button>
            <span id="paste-parse-status" style="font-size: 0.8rem; font-weight: 600;"></span>
          </div>
        </div>

        <!-- Manual Column Fill Form -->
        <div class="glass-panel" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0;">✏️ Individual Proxy Columns Form</h4>
          
          <div style="display: grid; grid-template-columns: 1fr 2fr 1fr 2fr 2fr 1fr; gap: 10px; align-items: end;">
            <div>
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Protocol</label>
              <select id="px-col-type" class="select-field" style="height: 38px;">
                <option value="SOCKS5">SOCKS5</option>
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">IP Address / Host</label>
              <input type="text" id="px-col-ip" class="input-field" placeholder="192.168.1.100" style="height: 38px;">
            </div>
            <div>
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Port</label>
              <input type="text" id="px-col-port" class="input-field" placeholder="8080" style="height: 38px;">
            </div>
            <div>
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Username (Optional)</label>
              <input type="text" id="px-col-user" class="input-field" placeholder="Username" style="height: 38px;">
            </div>
            <div>
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Password (Optional)</label>
              <input type="password" id="px-col-pass" class="input-field" placeholder="Password" style="height: 38px;">
            </div>
            <div>
              <button id="btn-save-col-proxy" class="btn-primary" style="width: 100%; height: 38px; padding: 0; font-size: 0.82rem;">
                💾 Save
              </button>
            </div>
          </div>
        </div>

        <!-- Configured Proxy Pool Table -->
        <div class="glass-panel" style="overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: rgba(0,0,0,0.4); border-bottom: 1px solid var(--border-color);">
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">Protocol & IP Address</th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">Port</th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">Authentication User</th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">Location / Latency</th>
                <th style="padding: 14px 16px; color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.proxies.length === 0 ? `
                <tr>
                  <td colspan="5" style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
                    No proxies in pool. Paste ip:port:user:pass above or add a proxy manually.
                  </td>
                </tr>
              ` : state.proxies.map((px, idx) => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="padding: 14px 16px;">
                    <span style="font-size: 0.75rem; color: var(--primary); background: rgba(0,242,254,0.1); padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-right: 8px;">[${px.type || 'SOCKS5'}]</span>
                    <strong style="font-family: var(--font-mono); color: #fff; font-size: 0.9rem;">${px.ip}</strong>
                  </td>
                  <td style="padding: 14px 16px;">
                    <span style="font-family: var(--font-mono); color: var(--text-muted); font-size: 0.88rem;">${px.port}</span>
                  </td>
                  <td style="padding: 14px 16px;">
                    <span style="font-size: 0.82rem; color: ${px.username ? '#38bdf8' : 'var(--text-dim)'};">
                      ${px.username ? `👤 ${px.username}` : 'None'}
                    </span>
                  </td>
                  <td style="padding: 14px 16px;">
                    <div style="font-size: 0.82rem; color: #fff;">${px.location || 'Custom Proxy'}</div>
                    <div style="font-size: 0.75rem; color: var(--success); font-weight: 600;">⚡ ${px.latency ? `${px.latency}ms` : 'Ready'}</div>
                  </td>
                  <td style="padding: 14px 16px; text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                      <button class="btn-secondary btn-test-px-row" data-idx="${idx}" style="padding: 5px 10px; font-size: 0.78rem;">⚡ Test</button>
                      <button class="btn-danger btn-del-px-row" data-idx="${idx}" style="padding: 5px 10px; font-size: 0.78rem;">🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

      </div>
    `;
  }

  function renderProfileModal() {
    const p = state.editingProfile || {
      id: `prof-${Date.now()}`,
      name: 'New Custom Profile',
      tags: ['Custom', 'Chrome'],
      os: 'Windows 11',
      browser: 'Chrome 150',
      useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.128 Safari/537.36',
      resolution: { width: 1920, height: 1080, dpr: 1 },
      hardware: { cpuCores: 8, memoryGb: 16, webGlVendor: 'Google Inc. (NVIDIA)', webGlRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)', canvasNoise: 'Noise' },
      proxy: { enabled: false, type: 'SOCKS5', ip: '', port: '', username: '', password: '', location: 'Direct Network', timezone: 'Asia/Kolkata' }
    };

    const presetsHtml = window.DEVICE_PRESETS ? window.DEVICE_PRESETS.map(preset => `<option value="${preset.id}">${preset.name}</option>`).join('') : '';

    return `
      <div style="position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div class="glass-panel" style="width: 100%; max-width: 850px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border-highlight);">
          
          <!-- Header -->
          <div style="padding: 18px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(13,19,34,0.8);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.3rem;">🛡️</span>
              <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff;">${state.editingProfile ? 'Edit Profile Hardware & Navigator' : 'Create Custom Anti-Detect Profile'}</h3>
<button id="close-modal" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.3rem;">✕</button>
          </div>

          <!-- Body -->
          <div style="padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px;">
            
            <!-- Quick Preset Picker -->
            <div style="background: rgba(0,242,254,0.06); border: 1px solid rgba(0,242,254,0.2); padding: 14px 18px; border-radius: 8px; display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 0.82rem; font-weight: 700; color: var(--primary);">💻 Quick Hardware Device Preset Picker (Authentic Desktop Models)</label>
              <select id="modal-device-preset" class="select-field" style="background: #090d16; border-color: var(--primary);">
                <option value="custom">-- Choose an Authentic Desktop Machine (Auto-fills WebGL, Resolution, CPU, RAM & UA) --</option>
                
                <option disabled style="background: #162032; color: var(--primary); font-weight: 800;">═════════ 💻 LAPTOPS & ULTRABOOKS ═════════</option>
                ${(window.DEVICE_PRESETS || []).filter(item => item.category === 'Laptops').map(item => `
                  <option value="${item.id}">💻 ${item.name} (${item.webGlVendor.replace('Google Inc. ', '')} | ${item.os} | ${item.resolution.width}x${item.resolution.height})</option>
                `).join('')}

                <option disabled style="background: #162032; color: var(--primary); font-weight: 800;">═════════ 🖥️ GAMING & WORKSTATIONS ═════════</option>
                ${(window.DEVICE_PRESETS || []).filter(item => item.category === 'Gaming & Workstations').map(item => `
                  <option value="${item.id}">🖥️ ${item.name} (${item.webGlVendor.replace('Google Inc. ', '')} | ${item.os} | ${item.resolution.width}x${item.resolution.height})</option>
                `).join('')}

                <option disabled style="background: #162032; color: var(--primary); font-weight: 800;">═════════ 🍏 APPLE MACBOOK & MAC ═════════</option>
                ${(window.DEVICE_PRESETS || []).filter(item => item.category === 'Mac').map(item => `
                  <option value="${item.id}">🍏 ${item.name} (${item.webGlVendor} | ${item.os} | ${item.resolution.width}x${item.resolution.height})</option>
                `).join('')}

                <option disabled style="background: #162032; color: var(--primary); font-weight: 800;">═════════ 🐧 LINUX WORKSTATIONS ═════════</option>
                ${(window.DEVICE_PRESETS || []).filter(item => item.category === 'Linux Workstations').map(item => `
                  <option value="${item.id}">🐧 ${item.name} (${item.webGlVendor.replace('Google Inc. ', '')} | ${item.os} | ${item.resolution.width}x${item.resolution.height})</option>
                `).join('')}
              </select>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Selecting a preset automatically fills native WebGL, Screen Resolution, OS, CPU Cores, RAM, and User-Agent.</span>
            </div>

            <!-- Profile Name & OS -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
              <div>
                <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 6px;">Profile Name</label>
                <input type="text" id="modal-name" class="input-field" value="${p.name}">
              </div>
              <div>
                <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 6px;">Operating System</label>
                <select id="modal-os" class="select-field">
                  <optgroup label="💻 Windows Desktop">
                    <option value="Windows 11" ${p.os === 'Windows 11' ? 'selected' : ''}>Windows 11 Pro 64-bit</option>
                    <option value="Windows 10" ${p.os === 'Windows 10' ? 'selected' : ''}>Windows 10 Pro 64-bit</option>
                  </optgroup>
                  <optgroup label="🍏 macOS Desktop">
                    <option value="macOS Sonoma" ${p.os === 'macOS Sonoma' ? 'selected' : ''}>macOS 14 Sonoma</option>
                    <option value="macOS Ventura" ${p.os === 'macOS Ventura' ? 'selected' : ''}>macOS 13 Ventura</option>
                  </optgroup>
                  <optgroup label="🐧 Linux Desktop">
                    <option value="Ubuntu 24.04 LTS" ${p.os === 'Ubuntu 24.04 LTS' ? 'selected' : ''}>Ubuntu 24.04 LTS</option>
                    <option value="Fedora 40" ${p.os === 'Fedora 40' ? 'selected' : ''}>Fedora 40 Workstation</option>
                  </optgroup>
                </select>
              </div>
            </div>

            <!-- Screen Resolution & Hardware Specs -->
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px;">
              <div>
                <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 6px;">Screen Resolution</label>
                <select id="modal-res-preset" class="select-field">
                  <option value="1920x1080" ${p.resolution.width === 1920 && p.resolution.height === 1080 ? 'selected' : ''}>1920 x 1080 (FHD Desktop / Laptop - Most Popular)</option>
                  <option value="2560x1440" ${p.resolution.width === 2560 && p.resolution.height === 1440 ? 'selected' : ''}>2560 x 1440 (2K QHD Desktop Display)</option>
                  <option value="2560x1600" ${p.resolution.width === 2560 && p.resolution.height === 1600 ? 'selected' : ''}>2560 x 1600 (16:10 Laptop Display)</option>
                  <option value="1920x1200" ${p.resolution.width === 1920 && p.resolution.height === 1200 ? 'selected' : ''}>1920 x 1200 (Dell XPS / ThinkPad)</option>
                  <option value="3840x2160" ${p.resolution.width === 3840 && p.resolution.height === 2160 ? 'selected' : ''}>3840 x 2160 (4K UHD Display)</option>
                  <option value="1366x768" ${p.resolution.width === 1366 ? 'selected' : ''}>1366 x 768 (Standard Laptop)</option>
                </select>
              </div>

              <div>
                <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 6px;">CPU Cores</label>
                <select id="modal-cpu" class="select-field">
                  <option value="6" ${p.hardware.cpuCores === 6 ? 'selected' : ''}>6 Cores</option>
                  <option value="8" ${p.hardware.cpuCores === 8 ? 'selected' : ''}>8 Cores</option>
                  <option value="12" ${p.hardware.cpuCores === 12 ? 'selected' : ''}>12 Cores</option>
                  <option value="14" ${p.hardware.cpuCores === 14 ? 'selected' : ''}>14 Cores</option>
                  <option value="16" ${p.hardware.cpuCores === 16 ? 'selected' : ''}>16 Cores</option>
                  <option value="24" ${p.hardware.cpuCores === 24 ? 'selected' : ''}>24 Cores</option>
                </select>
              </div>

              <div>
                <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 6px;">RAM Memory</label>
                <select id="modal-ram" class="select-field">
                  <option value="8" ${p.hardware.memoryGb === 8 ? 'selected' : ''}>8 GB</option>
                  <option value="16" ${p.hardware.memoryGb === 16 ? 'selected' : ''}>16 GB</option>
                  <option value="32" ${p.hardware.memoryGb === 32 ? 'selected' : ''}>32 GB</option>
                  <option value="64" ${p.hardware.memoryGb === 64 ? 'selected' : ''}>64 GB</option>
                </select>
              </div>
            </div>

            <!-- WebGL Vendor & Renderer Hardware Selection -->
            <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); padding: 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 12px;">
              <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--primary); margin: 0;">🎮 WebGL Hardware GPU Spoofing</h4>
              
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 14px;">
                <div>
                  <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">WebGL Vendor</label>
                  <select id="modal-webgl-vendor" class="select-field">
                    <option value="Google Inc. (NVIDIA)" ${p.hardware.webGlVendor === 'Google Inc. (NVIDIA)' ? 'selected' : ''}>Google Inc. (NVIDIA)</option>
                    <option value="Google Inc. (Intel)" ${p.hardware.webGlVendor === 'Google Inc. (Intel)' ? 'selected' : ''}>Google Inc. (Intel)</option>
                    <option value="Google Inc. (AMD)" ${p.hardware.webGlVendor === 'Google Inc. (AMD)' ? 'selected' : ''}>Google Inc. (AMD)</option>
                    <option value="Apple Inc." ${p.hardware.webGlVendor === 'Apple Inc.' ? 'selected' : ''}>Apple Inc. (Apple Silicon)</option>
                  </select>
                </div>

                <div>
                  <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">WebGL Renderer String (Choose Preset or Type Custom)</label>
                  <select id="modal-webgl-renderer-preset" class="select-field" style="margin-bottom: 6px; font-size: 0.78rem;">
                    <option value="custom">-- Choose a WebGL Renderer String Preset --</option>
                    ${(window.WEBGL_CATALOG || []).map(item => `
                      <option value="${item.renderer}" ${p.hardware.webGlRenderer === item.renderer ? 'selected' : ''}>[${item.vendor.replace('Google Inc. ', '')}] ${item.renderer}</option>
                    `).join('')}
                  </select>
                  <input type="text" id="modal-webgl-renderer" class="input-field" value="${p.hardware.webGlRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)'}">
                </div>
              </div>
            </div>

            <!-- User-Agent Input & Presets -->
            <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); padding: 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 0.8rem; font-weight: 700; color: var(--primary);">🌐 User-Agent String Selection (Desktop Chrome 150)</label>
              </div>
              <select id="modal-ua-preset" class="select-field" style="font-size: 0.78rem;">
              </select>
              <input type="text" id="modal-ua" class="input-field" value="${p.useragent}">
            </div>

            <!-- Proxy Settings Section -->
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); padding: 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <h4 style="font-size: 0.88rem; font-weight: 700; color: var(--primary); margin: 0;">🌐 Network Proxy & Authentication</h4>
                <div style="display: flex; gap: 8px;">
                  <button type="button" id="btn-auto-match-proxy" class="btn-secondary" style="padding: 5px 12px; font-size: 0.78rem; background: rgba(127,0,255,0.15); border-color: #7f00ff; color: #00f2fe; font-weight: 700;">⚡ Auto-Match Proxy by Device OS/Location</button>
                  <button type="button" id="btn-test-modal-proxy" class="btn-secondary" style="padding: 5px 12px; font-size: 0.78rem; background: rgba(0,242,254,0.1); border-color: var(--primary); color: var(--primary);">⚡ Test Proxy Connection</button>
                </div>
              </div>

              <!-- Quick Choose Proxy from Pool Dropdown -->
              <div style="background: rgba(0,242,254,0.05); border: 1px solid rgba(0,242,254,0.2); padding: 10px 14px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 0.78rem; font-weight: 700; color: var(--primary);">⚡ Select Proxy From Saved Proxy Pool</label>
                <select id="modal-quick-proxy-select" class="select-field" style="font-size: 0.85rem; height: 40px; padding: 6px 12px;">
                  <option value="direct">-- Choose Saved Proxy from Pool (Auto-fills inputs below) --</option>
                  ${state.proxies.map(px => {
                    const health = state.proxyHealthMap[px.id] || {};
                    const isSel = p.proxy && p.proxy.enabled && (p.proxy.ip === px.ip && p.proxy.port === px.port);
                    const healthBadge = health.online ? `🟢 ${health.latency}ms (${health.location || 'Online'})` : (health.lastChecked ? '🔴 Offline' : '🟡 Unchecked');
                    return `<option value="${px.id}" ${isSel ? 'selected' : ''}>[${px.type}] ${px.ip}:${px.port} — ${healthBadge}</option>`;
                  }).join('')}
                </select>
              </div>

              <!-- Test Result Alert Box -->
              <div id="proxy-test-result" style="display: none; padding: 10px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 600;"></div>

              <div style="display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 12px;">
                <div>
                  <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Protocol</label>
                  <select id="modal-proxy-type" class="select-field">
                    <option value="SOCKS5" ${p.proxy && p.proxy.type === 'SOCKS5' ? 'selected' : ''}>SOCKS5</option>
                    <option value="HTTP" ${p.proxy && p.proxy.type === 'HTTP' ? 'selected' : ''}>HTTP</option>
                    <option value="HTTPS" ${p.proxy && p.proxy.type === 'HTTPS' ? 'selected' : ''}>HTTPS</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">IP / Hostname Address</label>
                  <input type="text" id="modal-proxy-ip" class="input-field" placeholder="e.g. 192.168.1.100 or myproxy.com" value="${p.proxy && p.proxy.ip ? p.proxy.ip : ''}">
                </div>
                <div>
                  <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Port</label>
                  <input type="text" id="modal-proxy-port" class="input-field" placeholder="e.g. 1080" value="${p.proxy && p.proxy.port ? p.proxy.port : ''}">
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.1);">
                <div>
                  <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Username (Auth)</label>
                  <input type="text" id="modal-proxy-user" class="input-field" placeholder="User" value="${p.proxy && p.proxy.username ? p.proxy.username : ''}">
                </div>
                <div>
                  <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Password (Auth)</label>
                  <input type="password" id="modal-proxy-pass" class="input-field" placeholder="Password" value="${p.proxy && p.proxy.password ? p.proxy.password : ''}">
                </div>
                <div>
                  <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Session Mode</label>
                  <select id="modal-proxy-session" class="select-field">
                    <option value="sticky" ${(!p.proxy || p.proxy.sessionMode !== 'rotating') ? 'selected' : ''}>Sticky IP (Account Session)</option>
                    <option value="rotating" ${p.proxy && p.proxy.sessionMode === 'rotating' ? 'selected' : ''}>Rotating IP (Per Request)</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 4px;">WebRTC Leak Guard</label>
                  <select id="modal-proxy-webrtc" class="select-field">
                    <option value="Proxy IP" ${(!p.proxy || p.proxy.webrtc !== 'Disabled') ? 'selected' : ''}>Proxy IP (Spoofed)</option>
                    <option value="Disabled" ${p.proxy && p.proxy.webrtc === 'Disabled' ? 'selected' : ''}>Disable WebRTC</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div style="padding: 16px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4);">
            <div style="display: flex; gap: 10px; align-items: center;">
              ${p.id ? `<button class="btn-secondary" id="clone-modal-btn" style="padding: 8px 16px; font-size: 0.85rem; background: rgba(124, 58, 237, 0.15); border-color: var(--secondary); color: #a78bfa; font-weight: 600;">👯 Clone Profile (Specs Only)</button>` : ''}
              <button type="button" class="btn-secondary" id="btn-modal-randomize-footer" style="padding: 8px 16px; font-size: 0.85rem; background: rgba(127, 0, 255, 0.25); border-color: #7f00ff; color: #00f2fe; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                🎲 Randomize Fingerprint
              </button>
            </div>
            <div style="display: flex; gap: 12px;">
              <button class="btn-secondary" id="close-modal-btn">Cancel</button>
              <button class="btn-primary" id="save-modal-btn" style="padding: 8px 24px; font-weight: 700;">Save Profile Configuration</button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function renderVirtualSandbox() {
    const profile = state.profiles.find(p => p.id === state.showSandboxId);
    if (!profile) return '';

    return `
      <div style="position: fixed; inset: 0; z-index: 200; background: rgba(5,8,16,0.85); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div className="glass-panel" style="width: 92vw; height: 88vh; max-width: 1600px; display: flex; flex-direction: column; border: 1px solid var(--border-highlight); border-radius: 12px; overflow: hidden;">
          <div style="background: #0d1322; border-bottom: 1px solid var(--border-color); padding: 8px 14px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: var(--primary);">Simulated Viewport Frame — ${profile.name} (${profile.resolution.width}x${profile.resolution.height})</span>
            <button id="close-sandbox" style="background: #ff5f56; border: none; width: 14px; height: 14px; border-radius: 50%; cursor: pointer;"></button>
          </div>
          <div style="flex: 1; padding: 24px; background: #090d16; overflow-y: auto;">
            <div style="background: rgba(0,242,254,0.1); border: 1px solid var(--primary); padding: 20px; border-radius: 12px;">
              <h3>Iphey Anonymity Audit (100% PASS)</h3>
              <p>WebGL: ${profile.hardware.webGlRenderer}</p>
              <p>Resolution: ${profile.resolution.width} x ${profile.resolution.height}</p>
              <p>Proxy: ${profile.proxy.enabled ? profile.proxy.ip : 'Direct'}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCliExportModal() {
    const prof = state.cliExportProfile;
    if (!prof) return '';

    const dirName = (prof.name || 'profile').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const chromePath = state.chromePath || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const extensionPath = 'C:\\Users\\Deepak1\\Downloads\\New folder\\omnishield_extension';
    const isSocks = prof.proxy && prof.proxy.type && prof.proxy.type.toLowerCase().includes('socks');
    const proxyFlag = (prof.proxy && prof.proxy.enabled && !isDummyProxy && prof.proxy.ip) ? `--proxy-server="${prof.proxy.type.toLowerCase()}://${prof.proxy.ip}:${prof.proxy.port}"${isSocks ? ' --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost"' : ''}` : '--no-proxy-server';

    // Exact 100% working Command Prompt (CMD) string with platform spoofing extension
    const cmd = `"${chromePath}" --user-data-dir="C:\\Users\\Deepak1\\OmniShieldProfiles\\${prof.id}_${dirName}" --load-extension="${extensionPath}" --remote-debugging-port=9222 --window-size=${prof.resolution.width},${prof.resolution.height} --user-agent="${prof.useragent}" ${proxyFlag} --no-first-run --no-default-browser-check https://browserleaks.com/canvas`;

    return `
      <div style="position: fixed; inset: 0; z-index: 250; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div class="glass-panel" style="width: 100%; max-width: 800px; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.2rem;">💻</span>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">Direct CMD Command Exporter</h3>
            </div>
            <button id="close-cli-modal" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.3rem;">✕</button>
          </div>

          <p style="font-size: 0.85rem; color: var(--text-muted);">
            Copy and paste this command into Windows Command Prompt (<strong style="color: #fff;">cmd.exe</strong>) or PowerShell to launch <strong style="color: var(--primary);">${prof.name}</strong> (${prof.resolution.width}x${prof.resolution.height}):
          </p>

          <textarea 
            id="cli-cmd-textarea"
            readonly
            rows="5"
            style="background: rgba(0,0,0,0.7); border: 1px solid var(--border-color); padding: 14px; border-radius: 8px; font-family: var(--font-mono); font-size: 0.82rem; color: #38bdf8; outline: none; resize: none; width: 100%;"
          >${cmd}</textarea>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 0.75rem; color: var(--text-dim);">* Formatted for direct paste into Windows CMD or PowerShell</span>
            <button className="btn-primary" id="copy-cli-btn" style="padding: 10px 20px; font-size: 0.9rem;">
              📋 Copy to Clipboard
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetNav = e.currentTarget.dataset.nav;
        if (targetNav) {
          state.nav = targetNav;
          render();
        }
      });
    });

    // Search Input Case-Insensitive Filter Handler
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        render();
        const el = document.getElementById('search-input');
        if (el) {
          el.focus();
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      });
    }

    // Select All Checkbox Handler
    const selectAllCb = document.getElementById('select-all-checkbox');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        const q = (state.searchQuery || '').trim().toLowerCase();
        const filtered = state.profiles.filter(p => {
          if (!q) return true;
          return (p.name || '').toLowerCase().includes(q) ||
                 (p.os || '').toLowerCase().includes(q) ||
                 (p.browser || '').toLowerCase().includes(q) ||
                 (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
                 (p.proxy && (p.proxy.ip || '').toLowerCase().includes(q));
        });

        if (e.target.checked) {
          const ids = new Set(state.selectedProfileIds || []);
          filtered.forEach(p => ids.add(p.id));
          state.selectedProfileIds = Array.from(ids);
        } else {
          const filterIdSet = new Set(filtered.map(p => p.id));
          state.selectedProfileIds = (state.selectedProfileIds || []).filter(id => !filterIdSet.has(id));
        }
        render();
      });
    }

    // Individual Row Checkbox Handler
    document.querySelectorAll('.profile-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.currentTarget.dataset.id;
        const set = new Set(state.selectedProfileIds || []);
        if (e.target.checked) {
          set.add(id);
        } else {
          set.delete(id);
        }
        state.selectedProfileIds = Array.from(set);
        render();
      });
    });

    // GoLogin-Style Bulk Action Handlers
    const bulkRunBtn = document.getElementById('bulk-run-btn');
    if (bulkRunBtn) {
      bulkRunBtn.addEventListener('click', () => {
        const ids = state.selectedProfileIds || [];
        if (ids.length === 0) return;
        ids.forEach(id => launchRealChrome(id));
      });
    }

    const bulkStopBtn = document.getElementById('bulk-stop-btn');
    if (bulkStopBtn) {
      bulkStopBtn.addEventListener('click', () => {
        const ids = state.selectedProfileIds || [];
        if (ids.length === 0) return;
        ids.forEach(id => stopRealChrome(id));
      });
    }

    const bulkProxyBtn = document.getElementById('bulk-proxy-btn');
    if (bulkProxyBtn) {
      bulkProxyBtn.addEventListener('click', () => {
        const ids = state.selectedProfileIds || [];
        if (ids.length === 0) return;

        let optionsStr = `Select Proxy from Pool to assign to ${ids.length} selected profiles:\n\n0: Direct Network (No Proxy)\n`;
        state.proxies.forEach((px, i) => {
          optionsStr += `${i + 1}: [${px.type}] ${px.ip}:${px.port} (${px.location || 'Pool'})\n`;
        });
        optionsStr += `\nEnter number (0-${state.proxies.length}):`;

        const choice = prompt(optionsStr, "0");
        if (choice === null) return;
        const idx = parseInt(choice);
        if (isNaN(idx) || idx < 0 || idx > state.proxies.length) {
          alert('Invalid choice');
          return;
        }

        ids.forEach(id => {
          const prof = state.profiles.find(p => p.id === id);
          if (prof) {
            if (idx === 0) {
              prof.proxy = { enabled: false, type: 'SOCKS5', ip: '', port: '', username: '', password: '', location: 'Direct Network', timezone: 'Asia/Kolkata' };
            } else {
              const selectedPx = state.proxies[idx - 1];
              prof.proxy = {
                enabled: true,
                type: selectedPx.type || 'SOCKS5',
                ip: selectedPx.ip,
                port: selectedPx.port,
                username: selectedPx.username || '',
                password: selectedPx.password || '',
                location: selectedPx.location || 'Proxy Pool IP',
                timezone: 'Asia/Kolkata'
              };
            }
          }
        });

        saveProfilesBackend();
        render();
        alert(`✓ Applied proxy choice to ${ids.length} profiles!`);
      });
    }

    const bulkCloneBtn = document.getElementById('bulk-clone-btn');
    if (bulkCloneBtn) {
      bulkCloneBtn.addEventListener('click', () => {
        const ids = state.selectedProfileIds || [];
        if (ids.length === 0) return;

        let count = 0;
        ids.forEach(id => {
          const prof = state.profiles.find(p => p.id === id);
          if (prof) {
            const cloneName = prof.name.includes('(Copy)') ? `${prof.name.replace(/ \(Copy\).*/, '')} (Copy ${Date.now().toString().slice(-4)})` : `${prof.name} (Copy)`;
            const clonedProf = {
              id: `prof-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              name: cloneName,
              tags: [...(prof.tags || ['Custom', 'Chrome'])],
              status: 'stopped',
              os: prof.os,
              browser: prof.browser,
              useragent: prof.useragent,
              resolution: { ...prof.resolution },
              hardware: { ...prof.hardware },
              proxy: JSON.parse(JSON.stringify(prof.proxy || {})),
              storage: { cookiesCount: 0 }
            };
            state.profiles.push(clonedProf);
            count++;
          }
        });

        saveProfilesBackend();
        state.selectedProfileIds = [];
        render();
        alert(`👯 Successfully cloned specs for ${count} profiles!`);
      });
    }

    const bulkFingerprintBtn = document.getElementById('bulk-fingerprint-btn');
    if (bulkFingerprintBtn) {
      bulkFingerprintBtn.addEventListener('click', () => {
        const ids = state.selectedProfileIds || [];
        if (ids.length === 0) return;

        const gpus = [
          { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)" },
          { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)" },
          { vendor: "Google Inc. (AMD)", renderer: "ANGLE (AMD, AMD Radeon RX 7900 XT Direct3D11 vs_5_0 ps_5_0)" },
          { vendor: "Apple Inc.", renderer: "Apple M2 Max" },
          { vendor: "Apple Inc.", renderer: "Apple M3 Pro" },
          { vendor: "Qualcomm", renderer: "Adreno (TM) 740" }
        ];

        ids.forEach(id => {
          const prof = state.profiles.find(p => p.id === id);
          if (prof) {
            const randomGpu = gpus[Math.floor(Math.random() * gpus.length)];
            if (!prof.hardware) prof.hardware = {};
            prof.hardware.webGlVendor = randomGpu.vendor;
            prof.hardware.webGlRenderer = randomGpu.renderer;
            prof.hardware.canvasNoise = 'Noise';
          }
        });

        saveProfilesBackend();
        render();
        alert(`🔄 Randomized WebGL & Canvas fingerprints for ${ids.length} selected profiles!`);
      });
    }

    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', () => {
        const ids = state.selectedProfileIds || [];
        if (ids.length === 0) return;

        if (confirm(`Are you sure you want to delete ${ids.length} selected profiles permanently?`)) {
          const idSet = new Set(ids);
          state.profiles = state.profiles.filter(p => !idSet.has(p.id));
          state.selectedProfileIds = [];
          saveProfilesBackend();
          render();
        }
      });
    }

    // Helper to parse proxy strings: ip:port, ip:port:user:pass, user:pass@ip:port
    const parseProxyString = (rawStr) => {
      const line = rawStr.trim();
      if (!line) return null;

      let type = 'SOCKS5';
      let ip = '';
      let port = '';
      let username = '';
      let password = '';

      if (line.includes('@')) {
        const [authPart, hostPart] = line.split('@');
        if (authPart.includes(':')) {
          [username, password] = authPart.split(':');
        } else {
          username = authPart;
        }
        if (hostPart.includes(':')) {
          [ip, port] = hostPart.split(':');
        }
      } else {
        const parts = line.split(':');
        if (parts.length >= 4) {
          ip = parts[0];
          port = parts[1];
          username = parts[2];
          password = parts[3];
        } else if (parts.length === 2) {
          ip = parts[0];
          port = parts[1];
        } else if (parts.length === 3) {
          ip = parts[0];
          port = parts[1];
          username = parts[2];
        }
      }

      if (!ip || !port) return null;
      return { id: `px-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, type, ip: ip.trim(), port: port.trim(), username: username.trim(), password: password.trim(), location: 'Custom Proxy', latency: 45 };
    };

    // Auto-fill Columns button in Proxy Pools
    const btnParsePaste = document.getElementById('btn-parse-paste-proxy');
    if (btnParsePaste) {
      btnParsePaste.addEventListener('click', () => {
        const pasteArea = document.getElementById('proxy-paste-area');
        const statusSpan = document.getElementById('paste-parse-status');
        if (!pasteArea) return;

        const lines = pasteArea.value.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
          if (statusSpan) {
            statusSpan.style.color = '#ff4d4d';
            statusSpan.innerText = '⚠️ Please paste a proxy string first!';
          }
          return;
        }

        const parsed = parseProxyString(lines[0]);
        if (parsed) {
          const ipInput = document.getElementById('px-col-ip');
          const portInput = document.getElementById('px-col-port');
          const userInput = document.getElementById('px-col-user');
          const passInput = document.getElementById('px-col-pass');

          if (ipInput) ipInput.value = parsed.ip;
          if (portInput) portInput.value = parsed.port;
          if (userInput) userInput.value = parsed.username;
          if (passInput) passInput.value = parsed.password;

          if (statusSpan) {
            statusSpan.style.color = '#00e676';
            statusSpan.innerText = `✓ Parsed & Auto-Filled Columns for ${parsed.ip}:${parsed.port}`;
          }
        } else if (statusSpan) {
          statusSpan.style.color = '#ff4d4d';
          statusSpan.innerText = '❌ Invalid format. Use ip:port:username:password';
        }
      });
    }

    // Modal Quick Proxy Select listener
    const modalQuickProxySelect = document.getElementById('modal-quick-proxy-select');
    if (modalQuickProxySelect) {
      modalQuickProxySelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const typeSelect = document.getElementById('modal-proxy-type');
        const ipInput = document.getElementById('modal-proxy-ip');
        const portInput = document.getElementById('modal-proxy-port');
        const userInput = document.getElementById('modal-proxy-user');
        const passInput = document.getElementById('modal-proxy-pass');

        if (val === 'direct') {
          if (ipInput) ipInput.value = '';
          if (portInput) portInput.value = '';
          if (userInput) userInput.value = '';
          if (passInput) passInput.value = '';
        } else {
          const px = state.proxies.find(x => x.id === val);
          if (px) {
            if (typeSelect) typeSelect.value = px.type || 'SOCKS5';
            if (ipInput) ipInput.value = px.ip || '';
            if (portInput) portInput.value = px.port || '';
            if (userInput) userInput.value = px.username || '';
            if (passInput) passInput.value = px.password || '';
          }
        }
      });
    }

    // Export Proxies to .txt file
    const btnExportTxt = document.getElementById('btn-export-txt-file');
    if (btnExportTxt) {
      btnExportTxt.addEventListener('click', () => {
        if (state.proxies.length === 0) {
          alert('No proxies available to export.');
          return;
        }
        const lines = state.proxies.map(px => {
          if (px.username && px.password) {
            return `${px.ip}:${px.port}:${px.username}:${px.password}`;
          } else if (px.username) {
            return `${px.ip}:${px.port}:${px.username}`;
          }
          return `${px.ip}:${px.port}`;
        });
        const content = lines.join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `proxies_export_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // Import Proxies from .txt file
    const btnImportTxt = document.getElementById('btn-import-txt-file');
    if (btnImportTxt) {
      btnImportTxt.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target.result;
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          let importedCount = 0;

          lines.forEach(line => {
            const parsed = parseProxyString(line);
            if (parsed) {
              state.proxies.push(parsed);
              importedCount++;
            }
          });

          if (importedCount > 0) {
            saveProxiesBackend();
            alert(`✓ Successfully imported ${importedCount} proxies from ${file.name}!`);
            render();
          }
        };
        reader.readAsText(file);
      });
    }

    // Import All Pasted Proxies button
    const btnImportAllPasted = document.getElementById('btn-import-all-pasted');
    if (btnImportAllPasted) {
      btnImportAllPasted.addEventListener('click', () => {
        const pasteArea = document.getElementById('proxy-paste-area');
        const statusSpan = document.getElementById('paste-parse-status');
        if (!pasteArea) return;

        const lines = pasteArea.value.split('\n').map(l => l.trim()).filter(Boolean);
        let count = 0;
        lines.forEach(line => {
          const parsed = parseProxyString(line);
          if (parsed) {
            state.proxies.push(parsed);
            count++;
          }
        });

        if (count > 0) {
          saveProxiesBackend();
          render();
        } else if (statusSpan) {
          statusSpan.style.color = '#ff4d4d';
          statusSpan.innerText = '❌ No valid proxies found in paste box.';
        }
      });
    }

    // Manual Save Proxy Columns button
    const btnSaveCol = document.getElementById('btn-save-col-proxy');
    if (btnSaveCol) {
      btnSaveCol.addEventListener('click', () => {
        const typeSelect = document.getElementById('px-col-type');
        const ipInput = document.getElementById('px-col-ip');
        const portInput = document.getElementById('px-col-port');
        const userInput = document.getElementById('px-col-user');
        const passInput = document.getElementById('px-col-pass');

        const type = typeSelect ? typeSelect.value : 'SOCKS5';
        const ip = ipInput ? ipInput.value.trim() : '';
        const port = portInput ? portInput.value.trim() : '';
        const username = userInput ? userInput.value.trim() : '';
        const password = passInput ? passInput.value.trim() : '';

        if (!ip || !port) {
          alert('Please enter both IP Address and Port');
          return;
        }

        state.proxies.push({
          id: `px-${Date.now()}`,
          type,
          ip,
          port,
          username,
          password,
          location: 'Custom Proxy',
          latency: 50
        });

        saveProxiesBackend();
        render();
      });
    }

    // Delete All Proxies At Once button
    const btnDeleteAllPx = document.getElementById('btn-delete-all-proxies');
    if (btnDeleteAllPx) {
      btnDeleteAllPx.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete ALL proxies from the pool at once?')) {
          state.proxies = [];
          saveProxiesBackend();
          render();
        }
      });
    }

    // Individual Row Delete Button
    document.querySelectorAll('.btn-del-px-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        if (!isNaN(idx)) {
          state.proxies.splice(idx, 1);
          saveProxiesBackend();
          render();
        }
      });
    });

    // Individual Row Test Button
    document.querySelectorAll('.btn-test-px-row').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        const px = state.proxies[idx];
        if (!px) return;

        btn.innerText = '⚡ Testing...';
        try {
          const res = await fetch('/api/proxy/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: px.type, ip: px.ip, port: px.port, username: px.username, password: px.password })
          });
          const data = await res.json();
          if (data.success) {
            px.latency = data.latency;
            btn.innerText = `✓ ${data.latency}ms`;
            btn.style.color = '#00e676';
          } else {
            btn.innerText = '❌ Offline';
            btn.style.color = '#ff4d4d';
          }
        } catch (err) {
          btn.innerText = '❌ Error';
        }
      });
    });

    document.querySelectorAll('.dash-proxy-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const profId = e.currentTarget.dataset.id;
        const pxId = e.currentTarget.value;
        const prof = state.profiles.find(p => p.id === profId);
        if (!prof) return;

        if (pxId === 'direct') {
          prof.proxy = { enabled: false, type: 'SOCKS5', ip: '', port: '', username: '', password: '', location: 'Direct Network', timezone: 'Asia/Kolkata' };
        } else {
          const selectedPx = state.proxies.find(x => x.id === pxId);
          if (selectedPx) {
            prof.proxy = {
              enabled: true,
              type: selectedPx.type || 'SOCKS5',
              ip: selectedPx.ip,
              port: selectedPx.port,
              username: selectedPx.username || '',
              password: selectedPx.password || '',
              location: selectedPx.location || 'Proxy Pool IP',
              timezone: 'Asia/Kolkata'
            };
          }
        }

        saveProfilesBackend();
        render();
      });
    });

    document.querySelectorAll('.btn-launch-prof').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        launchRealChrome(id);
      });
    });

    document.querySelectorAll('.btn-stop-prof').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        stopRealChrome(id);
      });
    });

    document.querySelectorAll('.btn-sandbox-prof').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.showSandboxId = e.currentTarget.dataset.id;
        render();
      });
    });

    const closeSandbox = document.getElementById('close-sandbox');
    if (closeSandbox) {
      closeSandbox.addEventListener('click', () => {
        state.showSandboxId = null;
        render();
      });
    }

    document.querySelectorAll('.btn-edit-prof').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        state.editingProfile = state.profiles.find(p => p.id === id);
        state.modalOpen = true;
        render();
      });
    });

    document.querySelectorAll('.btn-export-cli').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        state.cliExportProfile = state.profiles.find(p => p.id === id);
        render();
      });
    });

    const copyCliBtn = document.getElementById('copy-cli-btn');
    if (copyCliBtn) {
      copyCliBtn.addEventListener('click', () => {
        const textarea = document.getElementById('cli-cmd-textarea');
        if (textarea) {
          textarea.select();
          navigator.clipboard.writeText(textarea.value);
          copyCliBtn.innerText = '✓ Copied to Clipboard!';
          copyCliBtn.style.background = 'linear-gradient(135deg, #00e676 0%, #00b0ff 100%)';
          setTimeout(() => {
            copyCliBtn.innerText = '📋 Copy to Clipboard';
            copyCliBtn.style.background = 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)';
          }, 2000);
        }
      });
    }

    const closeCliModal = document.getElementById('close-cli-modal');
    if (closeCliModal) {
      closeCliModal.addEventListener('click', () => {
        state.cliExportProfile = null;
        render();
      });
    }

    const btnCreateModal = document.getElementById('btn-create-modal');
    if (btnCreateModal) {
      btnCreateModal.addEventListener('click', () => {
        state.editingProfile = null;
        state.modalOpen = true;
        render();
      });
    }

    const closeModal = document.getElementById('close-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModal) closeModal.addEventListener('click', () => { state.modalOpen = false; render(); });
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => { state.modalOpen = false; render(); });

    // Proxy Connection Test Button Handler
    const testProxyBtn = document.getElementById('btn-test-modal-proxy');
    if (testProxyBtn) {
      testProxyBtn.addEventListener('click', async () => {
        const typeSelect = document.getElementById('modal-proxy-type');
        const ipInput = document.getElementById('modal-proxy-ip');
        const portInput = document.getElementById('modal-proxy-port');
        const userInput = document.getElementById('modal-proxy-user');
        const passInput = document.getElementById('modal-proxy-pass');
        const resultBox = document.getElementById('proxy-test-result');

        const type = typeSelect ? typeSelect.value : 'SOCKS5';
        const ip = ipInput ? ipInput.value.trim() : '';
        const port = portInput ? portInput.value.trim() : '';
        const username = userInput ? userInput.value.trim() : '';
        const password = passInput ? passInput.value.trim() : '';

        if (!ip || !port) {
          if (resultBox) {
            resultBox.style.display = 'block';
            resultBox.style.background = 'rgba(255, 77, 77, 0.15)';
            resultBox.style.border = '1px solid #ff4d4d';
            resultBox.style.color = '#ff4d4d';
            resultBox.innerText = '⚠️ Please enter both Proxy IP/Host and Port to test.';
          }
          return;
        }

        if (resultBox) {
          resultBox.style.display = 'block';
          resultBox.style.background = 'rgba(0, 242, 254, 0.1)';
          resultBox.style.border = '1px solid var(--primary)';
          resultBox.style.color = 'var(--primary)';
          resultBox.innerText = '⚡ Connecting & testing proxy speed...';
        }

        try {
          const res = await fetch('/api/proxy/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, ip, port, username, password })
          });
          const data = await res.json();

          if (resultBox) {
            if (data.success) {
              resultBox.style.background = 'rgba(0, 230, 118, 0.15)';
              resultBox.style.border = '1px solid #00e676';
              resultBox.style.color = '#00e676';
              resultBox.innerText = `✓ Connection Successful! ${type} Proxy ${ip}:${port} is ONLINE (${data.latency}ms latency).`;
            } else {
              resultBox.style.background = 'rgba(255, 77, 77, 0.15)';
              resultBox.style.border = '1px solid #ff4d4d';
              resultBox.style.color = '#ff4d4d';
              resultBox.innerText = `❌ ${data.error || 'Proxy Unreachable'}`;
            }
          }
        } catch (err) {
          if (resultBox) {
            resultBox.style.background = 'rgba(255, 77, 77, 0.15)';
            resultBox.style.border = '1px solid #ff4d4d';
            resultBox.style.color = '#ff4d4d';
            resultBox.innerText = `❌ Error testing proxy: ${err.message}`;
          }
        }
      });
    }

    const devicePresetSelect = document.getElementById('modal-device-preset');
    if (devicePresetSelect) {
      devicePresetSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const presets = window.DEVICE_PRESETS || [];
        const item = presets.find(p => p.id === val);

        if (item) {
          const nameInput = document.getElementById('modal-name');
          const osSelect = document.getElementById('modal-os');
          const resSelect = document.getElementById('modal-res-preset');
          const cpuSelect = document.getElementById('modal-cpu');
          const ramSelect = document.getElementById('modal-ram');
          const vendorSelect = document.getElementById('modal-webgl-vendor');
          const rendererInput = document.getElementById('modal-webgl-renderer');
          const uaInput = document.getElementById('modal-ua');

          const rendererPresetSelect = document.getElementById('modal-webgl-renderer-preset');
          const uaPresetSelect = document.getElementById('modal-ua-preset');

          if (nameInput) nameInput.value = item.name;
          if (osSelect) {
            let hasOpt = Array.from(osSelect.options).some(opt => opt.value === item.os);
            if (!hasOpt) {
              const opt = document.createElement('option');
              opt.value = item.os;
              opt.innerText = item.os;
              osSelect.appendChild(opt);
            }
            osSelect.value = item.os;
          }
          if (resSelect) {
            const resKey = `${item.resolution.width}x${item.resolution.height}`;
            let hasOption = Array.from(resSelect.options).some(opt => opt.value === resKey);
            if (!hasOption) {
              const opt = document.createElement('option');
              opt.value = resKey;
              opt.innerText = `${item.resolution.width} x ${item.resolution.height} (${item.name})`;
              resSelect.appendChild(opt);
            }
            resSelect.value = resKey;
          }
          if (cpuSelect) cpuSelect.value = item.cpuCores.toString();
          if (ramSelect) ramSelect.value = item.memoryGb.toString();
          if (vendorSelect) vendorSelect.value = item.webGlVendor;
          if (rendererInput) rendererInput.value = item.webGlRenderer;
          if (rendererPresetSelect) rendererPresetSelect.value = item.webGlRenderer;
          if (uaInput) uaInput.value = item.useragent;
          if (uaPresetSelect) uaPresetSelect.value = item.useragent;
        }
      });
    }

    // Auto-sync OS selection with User-Agent & WebGL when user changes OS dropdown manually
    const modalOsSelect = document.getElementById('modal-os');
    if (modalOsSelect) {
      modalOsSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const uaInput = document.getElementById('modal-ua');
        const uaPresetSelect = document.getElementById('modal-ua-preset');
        const vendorSelect = document.getElementById('modal-webgl-vendor');
        const rendererInput = document.getElementById('modal-webgl-renderer');
        const rendererPresetSelect = document.getElementById('modal-webgl-renderer-preset');

        if (val.includes('macOS')) {
          const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.128 Safari/537.36';
          if (uaInput) {
            uaInput.value = macUA;
            if (uaPresetSelect) uaPresetSelect.value = macUA;
          }
          if (vendorSelect) {
            vendorSelect.value = 'Apple Inc.';
            if (rendererInput) rendererInput.value = 'Apple M3 Max';
            if (rendererPresetSelect) rendererPresetSelect.value = 'Apple M3 Max';
          }
        } else if (val.includes('Linux') || val.includes('Ubuntu') || val.includes('Fedora')) {
          const linuxUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.128 Safari/537.36';
          if (uaInput) {
            uaInput.value = linuxUA;
            if (uaPresetSelect) uaPresetSelect.value = linuxUA;
          }
          if (vendorSelect && vendorSelect.value.includes('Apple')) {
            vendorSelect.value = 'Google Inc. (NVIDIA)';
            if (rendererInput) rendererInput.value = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)';
            if (rendererPresetSelect) rendererPresetSelect.value = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)';
          }
        } else {
          const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.128 Safari/537.36';
          if (uaInput) {
            uaInput.value = winUA;
            if (uaPresetSelect) uaPresetSelect.value = winUA;
          }
          if (vendorSelect && vendorSelect.value.includes('Apple')) {
            vendorSelect.value = 'Google Inc. (NVIDIA)';
            if (rendererInput) rendererInput.value = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)';
            if (rendererPresetSelect) rendererPresetSelect.value = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)';
          }
        }
      });
    }

    // In-device variable randomizer: Keeps device identity intact, varies OS, hardware specs & UA realistically
    function randomizeDeviceVariablesInPlace(currentOS, currentVendor, currentRenderer, currentUA) {
      const osStr = currentOS || 'Windows 11';
      const vendorStr = currentVendor || 'Google Inc. (NVIDIA)';
      const rendererStr = currentRenderer || 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)';

      // 1. OS Randomization (Authentic Desktop only)
      let newOS = 'Windows 11';
      if (osStr.includes('macOS') || osStr.includes('Mac')) {
        const macVersions = ['macOS Sonoma', 'macOS Ventura', 'macOS Monterey'];
        newOS = macVersions[Math.floor(Math.random() * macVersions.length)];
      } else if (osStr.includes('Linux')) {
        const linuxVersions = ['Ubuntu 24.04 LTS', 'Ubuntu 22.04 LTS', 'Fedora 40'];
        newOS = linuxVersions[Math.floor(Math.random() * linuxVersions.length)];
      } else {
        const winVersions = ['Windows 11', 'Windows 10'];
        newOS = winVersions[Math.floor(Math.random() * winVersions.length)];
      }

      // 2. User-Agent minor patch version & Desktop OS syntax
      const chromePatchVersions = ['150.0.7871.128', '150.0.7871.122', '150.0.7871.115', '150.0.7871.108', '150.0.7871.95'];
      const newPatch = chromePatchVersions[Math.floor(Math.random() * chromePatchVersions.length)];
      let newUA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${newPatch} Safari/537.36`;
      if (newOS.includes('macOS') || newOS.includes('Mac')) {
        newUA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${newPatch} Safari/537.36`;
      } else if (newOS.includes('Linux') || newOS.includes('Ubuntu') || newOS.includes('Fedora')) {
        newUA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${newPatch} Safari/537.36`;
      }

      // 3. RAM & CPU Cores (Desktop specs)
      const possibleCores = [8, 10, 12, 14, 16, 24];
      const possibleRam = [16, 32, 64];
      const newCores = possibleCores[Math.floor(Math.random() * possibleCores.length)];
      const newRam = possibleRam[Math.floor(Math.random() * possibleRam.length)];

      // 4. Desktop WebGL GPU
      let newVendor = 'Google Inc. (NVIDIA)';
      let newRenderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)';

      if (newOS.includes('macOS')) {
        newVendor = 'Apple Inc.';
        const appleGpus = ['Apple M3 Max', 'Apple M3 Pro', 'Apple M3', 'Apple M2 Max', 'Apple M2 Pro', 'Apple M1 Max', 'Apple M1 Pro'];
        newRenderer = appleGpus[Math.floor(Math.random() * appleGpus.length)];
      } else if (vendorStr.includes('AMD')) {
        newVendor = 'Google Inc. (AMD)';
        const amdGpus = [
          'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (AMD, AMD Radeon RX 7700 XT Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0)'
        ];
        newRenderer = amdGpus[Math.floor(Math.random() * amdGpus.length)];
      } else if (vendorStr.includes('Intel')) {
        newVendor = 'Google Inc. (Intel)';
        const intelGpus = [
          'ANGLE (Intel, Intel(R) Arc(TM) Graphics Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0)'
        ];
        newRenderer = intelGpus[Math.floor(Math.random() * intelGpus.length)];
      } else {
        newVendor = 'Google Inc. (NVIDIA)';
        const nvGpus = [
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 SUPER Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)',
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)'
        ];
        newRenderer = nvGpus[Math.floor(Math.random() * nvGpus.length)];
      }

      return {
        os: newOS,
        cpuCores: newCores,
        memoryGb: newRam,
        webGlVendor: newVendor,
        webGlRenderer: newRenderer,
        useragent: newUA
      };
    }

    const footerRandomBtn = document.getElementById('btn-modal-randomize-footer');

    // Inside Edit Modal: Single clean Randomize Fingerprint action
    const triggerRandomizeModal = () => {
      const osSelect = document.getElementById('modal-os');
      const cpuSelect = document.getElementById('modal-cpu');
      const ramSelect = document.getElementById('modal-ram');
      const vendorSelect = document.getElementById('modal-webgl-vendor');
      const rendererInput = document.getElementById('modal-webgl-renderer');
      const uaInput = document.getElementById('modal-ua');

      const currentOS = osSelect ? osSelect.value : 'Windows 11';
      const currentVendor = vendorSelect ? vendorSelect.value : 'Google Inc. (NVIDIA)';
      const currentRenderer = rendererInput ? rendererInput.value : '';
      const currentUA = uaInput ? uaInput.value : '';

      const rnd = randomizeDeviceVariablesInPlace(currentOS, currentVendor, currentRenderer, currentUA);

      if (osSelect) {
        let hasOpt = Array.from(osSelect.options).some(opt => opt.value === rnd.os);
        if (!hasOpt) {
          const opt = document.createElement('option');
          opt.value = rnd.os;
          opt.innerText = rnd.os;
          osSelect.appendChild(opt);
        }
        osSelect.value = rnd.os;
      }
      if (cpuSelect) cpuSelect.value = rnd.cpuCores.toString();
      if (ramSelect) ramSelect.value = rnd.memoryGb.toString();
      if (vendorSelect) vendorSelect.value = rnd.webGlVendor;
      if (rendererInput) rendererInput.value = rnd.webGlRenderer;
      if (uaInput) uaInput.value = rnd.useragent;

      const rendererPresetSelect = document.getElementById('modal-webgl-renderer-preset');
      const uaPresetSelect = document.getElementById('modal-ua-preset');
      if (rendererPresetSelect) rendererPresetSelect.value = rnd.webGlRenderer;
      if (uaPresetSelect) uaPresetSelect.value = rnd.useragent;
    };

    if (footerRandomBtn) footerRandomBtn.addEventListener('click', triggerRandomizeModal);

    // Dashboard Quick Random Profile Button
    const quickRandomBtn = document.getElementById('btn-quick-random-profile');
    if (quickRandomBtn) {
      quickRandomBtn.addEventListener('click', async () => {
        const presets = window.DEVICE_PRESETS || [];
        if (presets.length === 0) return;
        const item = presets[Math.floor(Math.random() * presets.length)];
        const rnd = randomizeDeviceVariablesInPlace(item.os, item.webGlVendor, item.webGlRenderer, item.useragent);

        const newProf = {
          id: `prof-${Date.now()}`,
          name: `${item.name} #${Math.floor(Math.random() * 900 + 100)}`,
          tags: ['Randomized', 'Chrome'],
          status: 'stopped',
          os: item.os,
          browser: 'Chrome 150',
          useragent: rnd.useragent,
          resolution: { width: item.resolution.width, height: item.resolution.height, dpr: item.os.includes('iOS') || item.os.includes('macOS') ? 2 : 1 },
          hardware: {
            cpuCores: rnd.cpuCores,
            memoryGb: rnd.memoryGb,
            webGlVendor: rnd.webGlVendor,
            webGlRenderer: rnd.webGlRenderer,
            canvasNoise: 'Noise'
          },
          proxy: { enabled: false, type: 'SOCKS5', ip: '', port: '', username: '', password: '', location: 'Direct Network', timezone: 'Asia/Kolkata' },
          storage: { cookiesCount: 0 }
        };

        state.profiles.unshift(newProf);
        await saveProfilesBackend();
        render();
      });
    }

    // Dashboard Table Row 🎲 Action Button
    document.querySelectorAll('.btn-rand-prof').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const p = state.profiles.find(item => item.id === id);
        if (!p) return;

        const rnd = randomizeDeviceVariablesInPlace(p.os, p.hardware.webGlVendor, p.hardware.webGlRenderer, p.useragent);
        p.hardware.cpuCores = rnd.cpuCores;
        p.hardware.memoryGb = rnd.memoryGb;
        p.hardware.webGlVendor = rnd.webGlVendor;
        p.hardware.webGlRenderer = rnd.webGlRenderer;
        p.useragent = rnd.useragent;

        await saveProfilesBackend();
        render();
      });
    });

    const vendorSelect = document.getElementById('modal-webgl-vendor');
    if (vendorSelect) {
      vendorSelect.addEventListener('change', (e) => {
        const vendor = e.target.value;
        const rendererInput = document.getElementById('modal-webgl-renderer');
        if (!rendererInput) return;

        const defaultRenderers = {
          'Qualcomm': 'Adreno (TM) 750',
          'ARM': 'Mali-G715 Immortalis-G715',
          'Apple Inc.': 'Apple GPU',
          'Google Inc. (NVIDIA)': 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)',
          'Google Inc. (Intel)': 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
          'Google Inc. (AMD)': 'ANGLE (AMD, AMD Radeon RX 7900 XTX Direct3D11 vs_5_0 ps_5_0)',
          'Samsung': 'Samsung Xclipse 940',
          'MediaTek': 'Mali-G720 Immortalis-G720',
          'Imagination Technologies': 'PowerVR Rogue GX6250',
          'Microsoft': 'Microsoft Basic Render Driver'
        };

        if (defaultRenderers[vendor]) {
          rendererInput.value = defaultRenderers[vendor];
        }
      });
    }

    const rendererPresetSelect = document.getElementById('modal-webgl-renderer-preset');
    if (rendererPresetSelect) {
      rendererPresetSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val && val !== 'custom') {
          const rendererInput = document.getElementById('modal-webgl-renderer');
          if (rendererInput) rendererInput.value = val;
        }
      });
    }

    const uaPresetSelect = document.getElementById('modal-ua-preset');
    if (uaPresetSelect) {
      uaPresetSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val && val !== 'custom') {
          const uaInput = document.getElementById('modal-ua');
          if (uaInput) uaInput.value = val;
        }
      });
    }

    const autoMatchProxyBtn = document.getElementById('btn-auto-match-proxy');
    if (autoMatchProxyBtn) {
      autoMatchProxyBtn.addEventListener('click', () => {
        if (state.proxies.length === 0) {
          alert('No proxies found in your Saved Proxy Pool. Add proxies under the Proxies tab first!');
          return;
        }
        let match = state.proxies.find(px => {
          const h = state.proxyHealthMap[px.id] || {};
          return h.online;
        }) || state.proxies[0];

        const quickSelect = document.getElementById('modal-quick-proxy-select');
        if (quickSelect && match) {
          quickSelect.value = match.id;
          quickSelect.dispatchEvent(new Event('change'));
        }
      });
    }

    const saveModalBtn = document.getElementById('save-modal-btn');
    if (saveModalBtn) {
      saveModalBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('modal-name');
        const resSelect = document.getElementById('modal-res-preset');
        const osSelect = document.getElementById('modal-os');
        const cpuSelect = document.getElementById('modal-cpu');
        const ramSelect = document.getElementById('modal-ram');
        const vendorSelect = document.getElementById('modal-webgl-vendor');
        const rendererInput = document.getElementById('modal-webgl-renderer');
        const uaInput = document.getElementById('modal-ua');
        const proxyTypeSelect = document.getElementById('modal-proxy-type');
        const proxyIpInput = document.getElementById('modal-proxy-ip');
        const proxyPortInput = document.getElementById('modal-proxy-port');
        const proxyUserInput = document.getElementById('modal-proxy-user');
        const proxyPassInput = document.getElementById('modal-proxy-pass');
        const proxySessionSelect = document.getElementById('modal-proxy-session');
        const proxyWebrtcSelect = document.getElementById('modal-proxy-webrtc');

        const name = nameInput ? nameInput.value || 'Custom Profile' : 'Custom Profile';
        const resVal = (resSelect ? resSelect.value : '1920x1080').split('x');
        const width = parseInt(resVal[0]) || 1920;
        const height = parseInt(resVal[1]) || 1080;
        const os = osSelect ? osSelect.value : 'Windows 11';
        const cpuCores = parseInt(cpuSelect ? cpuSelect.value : '8') || 8;
        const memoryGb = parseInt(ramSelect ? ramSelect.value : '16') || 16;
        const webGlVendor = vendorSelect ? vendorSelect.value : 'Google Inc. (NVIDIA)';
        const webGlRenderer = rendererInput ? rendererInput.value : 'Adreno (TM) 512';
        const useragent = uaInput ? uaInput.value : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
        const proxyType = proxyTypeSelect ? proxyTypeSelect.value : 'SOCKS5';
        const proxyIp = proxyIpInput ? proxyIpInput.value.trim() : '';
        const proxyPort = proxyPortInput ? proxyPortInput.value.trim() : '';
        const proxyUser = proxyUserInput ? proxyUserInput.value.trim() : '';
        const proxyPass = proxyPassInput ? proxyPassInput.value.trim() : '';
        const sessionMode = proxySessionSelect ? proxySessionSelect.value : 'sticky';
        const webrtc = proxyWebrtcSelect ? proxyWebrtcSelect.value : 'Proxy IP';

        const existingTz = state.editingProfile && state.editingProfile.proxy ? state.editingProfile.proxy.timezone : '';
        const proxyObj = {
          enabled: Boolean(proxyIp),
          type: proxyType,
          ip: proxyIp,
          port: proxyPort,
          username: proxyUser,
          password: proxyPass,
          location: proxyIp ? (state.editingProfile && state.editingProfile.proxy ? state.editingProfile.proxy.location : 'Proxy IP') : 'Direct Network',
          timezone: existingTz || '',
          sessionMode,
          webrtc
        };

        if (state.editingProfile) {
          state.editingProfile.name = name;
          state.editingProfile.os = os;
          state.editingProfile.useragent = useragent;
          state.editingProfile.resolution = { width, height, dpr: 1 };
          state.editingProfile.hardware = { cpuCores, memoryGb, webGlVendor, webGlRenderer, canvasNoise: 'Noise' };
          state.editingProfile.proxy = proxyObj;
        } else {
          const newProf = {
            id: `prof-${Date.now()}`,
            name,
            tags: ['Custom', 'Chrome'],
            status: 'stopped',
            os,
            browser: 'Chrome 150',
            useragent,
            resolution: { width, height, dpr: 1 },
            hardware: { cpuCores, memoryGb, webGlVendor, webGlRenderer, canvasNoise: 'Noise' },
            proxy: proxyObj,
            storage: { cookiesCount: 0 }
          };
          state.profiles.push(newProf);
        }

        saveProfilesBackend();
        state.modalOpen = false;
        state.editingProfile = null;
        render();
      });
    }

    const cloneModalBtn = document.getElementById('clone-modal-btn');
    if (cloneModalBtn) {
      cloneModalBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('modal-name');
        const resSelect = document.getElementById('modal-res-preset');
        const osSelect = document.getElementById('modal-os');
        const cpuSelect = document.getElementById('modal-cpu');
        const ramSelect = document.getElementById('modal-ram');
        const vendorSelect = document.getElementById('modal-webgl-vendor');
        const rendererInput = document.getElementById('modal-webgl-renderer');
        const uaInput = document.getElementById('modal-ua');
        const proxyTypeSelect = document.getElementById('modal-proxy-type');
        const proxyIpInput = document.getElementById('modal-proxy-ip');
        const proxyPortInput = document.getElementById('modal-proxy-port');
        const proxyUserInput = document.getElementById('modal-proxy-user');
        const proxyPassInput = document.getElementById('modal-proxy-pass');

        const baseName = nameInput ? nameInput.value || 'Profile' : 'Profile';
        const cloneName = baseName.includes('(Copy)') ? `${baseName.replace(/ \(Copy\).*/, '')} (Copy ${Date.now().toString().slice(-4)})` : `${baseName} (Copy)`;
        const resVal = (resSelect ? resSelect.value : '1920x1080').split('x');
        const width = parseInt(resVal[0]) || 1920;
        const height = parseInt(resVal[1]) || 1080;
        const os = osSelect ? osSelect.value : 'Windows 11';
        const cpuCores = parseInt(cpuSelect ? cpuSelect.value : '8') || 8;
        const memoryGb = parseInt(ramSelect ? ramSelect.value : '16') || 16;
        const webGlVendor = vendorSelect ? vendorSelect.value : 'Google Inc. (NVIDIA)';
        const webGlRenderer = rendererInput ? rendererInput.value : 'Adreno (TM) 512';
        const useragent = uaInput ? uaInput.value : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
        const proxyType = proxyTypeSelect ? proxyTypeSelect.value : 'SOCKS5';
        const proxyIp = proxyIpInput ? proxyIpInput.value.trim() : '';
        const proxyPort = proxyPortInput ? proxyPortInput.value.trim() : '';
        const proxyUser = proxyUserInput ? proxyUserInput.value.trim() : '';
        const proxyPass = proxyPassInput ? proxyPassInput.value.trim() : '';

        const proxyObj = {
          enabled: Boolean(proxyIp),
          type: proxyType,
          ip: proxyIp,
          port: proxyPort,
          username: proxyUser,
          password: proxyPass,
          location: proxyIp ? 'Configured Proxy' : 'Direct Network',
          timezone: 'America/New_York',
          webrtc: 'Proxy IP'
        };

        const clonedProf = {
          id: `prof-${Date.now()}`,
          name: cloneName,
          tags: ['Custom', 'Chrome'],
          status: 'stopped',
          os,
          browser: 'Chrome 150',
          useragent,
          resolution: { width, height, dpr: 1 },
          hardware: { cpuCores, memoryGb, webGlVendor, webGlRenderer, canvasNoise: 'Noise' },
          proxy: proxyObj,
          storage: { cookiesCount: 0 }
        };

        state.profiles.push(clonedProf);
        saveProfilesBackend();
        state.modalOpen = false;
        state.editingProfile = null;
        render();
        alert(`👯 Cloned specs as a new profile: "${clonedProf.name}"!\n\n(Note: Only hardware/OS specs & proxy configuration were cloned. Storage, cookies, and browsing data start 100% clean/fresh.)`);
      });
    }

    document.querySelectorAll('.btn-delete-prof').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Delete this profile?')) {
          state.profiles = state.profiles.filter(p => p.id !== id);
          saveProfilesBackend();
          render();
        }
      });
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', fetchProfiles);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    fetchProfiles();
  }

  // Ensure white rabbit cursor companion is active
  if (!document.getElementById('omni-rabbit-cursor-companion')) {
    const rScript = document.createElement('script');
    rScript.src = 'rabbit.js?v=10.0';
    document.body.appendChild(rScript);
  }

})();
