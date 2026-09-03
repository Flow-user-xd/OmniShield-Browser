# 🛡️ OmniShield — Next-Gen Virtual Anti-Detect Browser Studio

[![Chromium Version](https://img.shields.io/badge/Chromium-150.0.7871.128-blue.svg?style=flat-square&logo=googlechrome)](https://github.com)
[![Stealth Authenticity](https://img.shields.io/badge/BrowserScan-100%25%20Authentic-brightgreen.svg?style=flat-square)](https://www.browserscan.net)
[![Bot Detection](https://img.shields.io/badge/Bot%20Detection-0%25%20(Zero%20Flags)-success.svg?style=flat-square)](https://creepjs-api.web.app)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square)](https://github.com)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?style=flat-square&logo=python)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](LICENSE)

**OmniShield** is an advanced, high-stealth virtual anti-detect browser studio built on portable Ungoogled Chromium. It equips web scrapers, multi-account operators, privacy advocates, and security researchers with completely isolated, genuine browser instances that achieve **100% authenticity scores** across top fingerprint testing suites including **BrowserScan**, **BrowserLeaks**, and **CreepJS**.

---

## 🌟 Key Features

### 🎨 Per-Profile Unique Canvas Signatures
- Custom-engineered pixel noise generator with mathematical deterministic seeds derived per profile.
- Produces **100% unique cryptographic canvas hashes (MD5)** on BrowserLeaks without failing sub-pixel antialiasing or integrity checks.
- Zero detection on BrowserScan canvas integrity checks (`21x120` & `240x60` calibration matrices).

### 🖥️ Authentic Desktop Hardware Virtualization
- **Strictly Genuine Desktop Presets**: Eliminates mobile emulation giveaways (font rasterization mismatches, missing DirectWrite subpixel antialiasing, WebKit vs Blink mismatches).
- **30+ Realistic Desktop GPUs**: NVIDIA GeForce RTX 4090 / 4080 / 4070 / 3080 / 3060, Intel Arc A770 / Iris Xe / UHD 770, AMD Radeon RX 7900 XTX / 7800 XT, Apple M3 Max / M2 Ultra.
- Realistic core allocations (8–24 vCPUs) and RAM footprints (16–64 GB).

### 🔍 Smart Omnibox Search Resolver
- Eliminates Ungoogled Chromium's default `http://{searchTerms}/` URL formatting error.
- Intercepts natural address bar search queries with zero latency via `chrome.webNavigation` and seamlessly directs them to Google Search.
- Intelligently differentiates search queries from valid domain names (`.com`, `.org`, `.io`, etc.) and preserves local addresses (`localhost:3000`, `127.0.0.1`).

### 🌐 Isolated Proxy Routing & WebRTC Shield
- Supports SOCKS5, HTTP, and HTTPS proxy tunnels with per-profile credentials.
- Enforces strict WebRTC routing policies (`disable_non_proxied_udp`) to prevent real IP leaks.
- Real-time proxy latency measurement and automated IP geolocation lookup.

### 🐰 Interactive White Rabbit Companion
- Modern, physics-driven UI companion that tracks the user's cursor across the studio dashboard.
- Features hopping arcs, dust particle puffs, ear/nose twitches, directional turning, and resting idle breathing directly beneath the cursor.

---

## 📊 Live Verification Benchmarks

| Verification Test | Native Unspoofed | OmniShield Profile 1 (Alienware) | OmniShield Profile 2 (Dell XPS) |
| :--- | :--- | :--- | :--- |
| **BrowserScan Authenticity** | 85% – 90% | **100% (0 deductions)** | **100% (0 deductions)** |
| **BrowserScan Bot Detection** | 0% | **0% (Undetected)** | **0% (Undetected)** |
| **BrowserLeaks Canvas Hash** | `8D90D8D3...CD3D` | `2F12945E...D772` | `2A5356E2...1CD1` |
| **Canvas Hash Collision** | Native | **Unique (No Collision)** | **Unique (No Collision)** |
| **Chrome Version Alignment**| Chrome 150 | **Chrome 150.0.7871.128** | **Chrome 150.0.7871.128** |
| **Omnibox Search** | Normal | **Normal (Google Search)** | **Normal (Google Search)** |

---

## 🏗️ Architecture

```
OmniShield Studio (Web UI :3000)
    │
    ├── server.py (Lightweight Python HTTP Backend)
    │     ├── /api/profiles        ──> Load & Manage Profile Store (profiles.json)
    │     ├── /api/profiles/launch ──> Launch Chromium Subprocess with Stealth Engine
    │     └── /api/proxy/test      ──> Socket Latency & Geo Resolution
    │
    └── stealth_engine.py (Browser Orchestration & Anti-Detect Core)
          ├── browser_core/chrome.exe (Portable Ungoogled Chromium 150)
          ├── omnishield_ext/ (Injected Per-Profile Anti-Detect Extension)
          │     ├── config.js    ──> Profile Fingerprint Seeds & Hardware Specs
          │     ├── inject.js    ──> Prototype Overrides (Canvas, WebGL, Audio, Navigator)
          │     └── background.js──> Client Hints (Sec-CH-UA) & Omnibox Search Resolver
          └── Proxy Bridge       ──> WebRTC Isolation & Authenticated Tunneling
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Operating System**: Windows 10/11 (macOS / Linux supported)
- **Python**: Version 3.10 or newer

### 2. Installation
Clone the repository and install the lightweight dependencies:
```bash
git clone https://github.com/your-username/OmniShield-Browser.git
cd OmniShield-Browser
pip install -r requirements.txt
```

### 3. Running the Studio
Launch the OmniShield Studio server:
```bash
python server.py
```
Open your browser and navigate to:
```
http://localhost:3000
```

### 4. Launching a Profile
1. Click **"Launch Chrome Window"** on any pre-configured profile (*Alienware x16 R2*, *Dell XPS 15*, or *MacBook Pro M3*).
2. A physical Chromium window opens with isolated local storage, spoofed GPU/Client Hints, and proxy routing.
3. Test your anonymity instantly at [BrowserScan](https://www.browserscan.net) or [BrowserLeaks](https://browserleaks.com/canvas).

---

## ⚙️ Profile Customization

Profiles are configured via the web UI or directly in `profiles.json`:

```json
{
  "id": "prof-1",
  "name": "Alienware x16 R2 Gaming Rig",
  "group": "Desktops",
  "tags": ["Windows 11", "RTX 4090", "Stealth"],
  "status": "stopped",
  "os": "Windows 11",
  "browser": "Chrome 150",
  "useragent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.7871.128 Safari/537.36",
  "resolution": { "width": 1920, "height": 1080, "dpr": 1 },
  "hardware": {
    "cpuCores": 16,
    "memoryGb": 64,
    "webGlVendor": "Google Inc. (NVIDIA)",
    "webGlRenderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0)",
    "canvasNoise": "Noise"
  },
  "proxy": {
    "enabled": false,
    "type": "SOCKS5",
    "ip": "",
    "port": "",
    "location": "Direct Network",
    "timezone": "Asia/Kolkata",
    "webrtc": "Proxy IP"
  }
}
```

---

## 🔒 Security & Privacy Notice
OmniShield is built for legitimate multi-account management, QA testing, and privacy research. It runs 100% locally on your machine with no telemetry, external analytics, or remote control dependencies.

---

## 📜 License
This project is licensed under the [MIT License](LICENSE).
