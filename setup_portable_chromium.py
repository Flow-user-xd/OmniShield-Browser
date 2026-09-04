import os
import sys
import zipfile
import urllib.request
import json
import shutil
import time

CURATED_VERSIONS = [
    {
        "label": "Chromium 151 (Latest Stable - 151.0.7922.173) [Recommended]",
        "version": "151.0.7922.173",
        "url": "https://github.com/ungoogled-software/ungoogled-chromium-windows/releases/download/151.0.7922.173-1.1/ungoogled-chromium_151.0.7922.173-1.1_windows_x64.zip"
    },
    {
        "label": "Chromium 150 (Recent Stable - 150.0.7871.186)",
        "version": "150.0.7871.186",
        "url": "https://github.com/ungoogled-software/ungoogled-chromium-windows/releases/download/150.0.7871.186-1.1/ungoogled-chromium_150.0.7871.186-1.1_windows_x64.zip"
    },
    {
        "label": "Chromium 150 (LTS Baseline - 150.0.7871.128) [Stealth Calibrated]",
        "version": "150.0.7871.128",
        "url": "https://github.com/ungoogled-software/ungoogled-chromium-windows/releases/download/150.0.7871.128-1.1/ungoogled-chromium_150.0.7871.128-1.1_windows_x64.zip"
    }
]

def fetch_latest_releases(limit=3):
    """Attempt to fetch newest releases from GitHub API, falling back to curated list."""
    try:
        req = urllib.request.Request(
            'https://api.github.com/repos/ungoogled-software/ungoogled-chromium-windows/releases?per_page=10',
            headers={'User-Agent': 'OmniShield-Installer/2.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = []
            for rel in data:
                tag = rel.get('tag_name', '')
                for asset in rel.get('assets', []):
                    name = asset.get('name', '')
                    if 'windows_x64.zip' in name and 'installer' not in name:
                        clean_ver = tag.split('-')[0]
                        results.append({
                            "label": f"Chromium {clean_ver} ({tag})",
                            "version": clean_ver,
                            "url": asset.get('browser_download_url')
                        })
                        break
                if len(results) >= limit:
                    break
            if len(results) >= limit:
                return results
    except Exception:
        pass
    return CURATED_VERSIONS[:limit]

def prompt_version_choice(versions):
    print("\n" + "=" * 65)
    print("   🛡️  OmniShield Studio — Chromium Browser Core Setup")
    print("=" * 65)
    print("Select a portable Ungoogled Chromium version to install:\n")
    for i, v in enumerate(versions, 1):
        print(f"  [{i}] {v['label']}")
    print("\n" + "-" * 65)
    
    choice = input("Enter choice [1-3] (Press Enter for [1]): ").strip()
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(versions):
            return versions[idx]
    except Exception:
        pass
    return versions[0]

def download_and_setup_portable_chromium(force_interactive=False, chosen_version=None, progress_callback=None):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    target_dir = os.path.join(base_dir, 'browser_core')
    chrome_exec = os.path.join(target_dir, 'chrome.exe')

    if os.path.exists(chrome_exec) and not force_interactive and not chosen_version:
        print(f"[Portable Engine] Portable Chromium already installed at: {chrome_exec}")
        return chrome_exec

    versions = fetch_latest_releases(3)
    if chosen_version:
        if isinstance(chosen_version, dict):
            selected = chosen_version
        else:
            # Match by version string or index
            selected = next((v for v in versions if chosen_version in v['version'] or chosen_version in v['label']), None)
            if not selected:
                try:
                    idx = int(chosen_version) - 1
                    if 0 <= idx < len(versions):
                        selected = versions[idx]
                except Exception:
                    pass
            if not selected:
                selected = versions[0]
    elif force_interactive:
        selected = prompt_version_choice(versions)
    else:
        selected = versions[0]

    url = selected['url']

    print(f"\n[Portable Engine] Selected: {selected['label']}")
    print(f"[Portable Engine] Downloading from: {url}")
    if progress_callback:
        progress_callback({"status": "starting", "percent": 0, "label": selected['label'], "version": selected.get('version', '')})

    os.makedirs(target_dir, exist_ok=True)
    zip_path = os.path.join(base_dir, 'chromium_portable.zip')

    try:
        # Check remote size
        total_size = 0
        try:
            head_req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}, method='HEAD')
            with urllib.request.urlopen(head_req, timeout=10) as h_resp:
                total_size = int(h_resp.headers.get('content-length', 0))
        except Exception:
            pass

        max_retries = 10
        for attempt in range(max_retries):
            downloaded = os.path.getsize(zip_path) if os.path.exists(zip_path) else 0
            if total_size > 0 and downloaded >= total_size:
                print("\n[Portable Engine] Download complete!")
                break

            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            if downloaded > 0:
                headers['Range'] = f"bytes={downloaded}-"

            try:
                req = urllib.request.Request(url, headers=headers)
                mode = 'ab' if downloaded > 0 else 'wb'
                with urllib.request.urlopen(req, timeout=30) as resp, open(zip_path, mode) as out:
                    if total_size == 0 and resp.headers.get('content-length'):
                        total_size = downloaded + int(resp.headers.get('content-length'))

                    block_size = 1024 * 128
                    last_cb_time = 0
                    while True:
                        buffer = resp.read(block_size)
                        if not buffer:
                            break
                        downloaded += len(buffer)
                        out.write(buffer)
                        percent = int(downloaded * 100 / total_size) if total_size > 0 else 0
                        mb_done = downloaded / (1024 * 1024)
                        mb_total = total_size / (1024 * 1024) if total_size > 0 else 0
                        sys.stdout.write(f"\r[Portable Engine] Downloading: {percent}% [{mb_done:.1f} MB / {mb_total:.1f} MB]")
                        sys.stdout.flush()

                        cur_time = time.time()
                        if progress_callback and (cur_time - last_cb_time > 0.5 or downloaded >= total_size):
                            last_cb_time = cur_time
                            progress_callback({
                                "status": "downloading",
                                "percent": percent,
                                "mb_done": round(mb_done, 1),
                                "mb_total": round(mb_total, 1),
                                "label": selected['label']
                            })

                if total_size > 0 and downloaded >= total_size:
                    break
            except Exception as retry_err:
                print(f"\n[Portable Engine] Download interrupted ({retry_err}). Retrying attempt {attempt + 1}/{max_retries} in 2s...")
                time.sleep(2)

        print("\n[Portable Engine] Download finished! Extracting packages...")
        if progress_callback:
            progress_callback({"status": "extracting", "percent": 100, "label": selected['label']})

        extract_tmp = os.path.join(base_dir, 'extract_tmp')
        if os.path.exists(extract_tmp):
            shutil.rmtree(extract_tmp, ignore_errors=True)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_tmp)

            found_dir = None
            for root, dirs, files in os.walk(extract_tmp):
                if 'chrome.exe' in files:
                    found_dir = root
                    break

            if found_dir:
                shutil.copytree(found_dir, target_dir, dirs_exist_ok=True)
                shutil.rmtree(extract_tmp, ignore_errors=True)
                print(f"[Portable Engine] Portable Chromium successfully installed to:\n  {chrome_exec}")

        if os.path.exists(zip_path):
            os.remove(zip_path)

        if progress_callback:
            progress_callback({"status": "ready", "percent": 100, "chromePath": chrome_exec})

        return chrome_exec

    except Exception as e:
        print(f"\n[Portable Engine Error] Failed to setup portable Chromium: {e}")
        if progress_callback:
            progress_callback({"status": "error", "error": str(e)})
        return None

if __name__ == '__main__':
    force = '--choose' in sys.argv or '--interactive' in sys.argv
    chosen = None
    for arg_idx, arg in enumerate(sys.argv):
        if arg in ('--choice', '-c', '--version', '-v') and arg_idx + 1 < len(sys.argv):
            chosen = sys.argv[arg_idx + 1]
            break
    download_and_setup_portable_chromium(force_interactive=force, chosen_version=chosen)
