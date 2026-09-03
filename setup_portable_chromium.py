import os
import sys
import zipfile
import urllib.request
import shutil

def download_and_setup_portable_chromium():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    target_dir = os.path.join(base_dir, 'browser_core')
    chrome_exec = os.path.join(target_dir, 'chrome.exe')

    if os.path.exists(chrome_exec):
        print(f"[Portable Engine] Portable Chromium already exists at: {chrome_exec}")
        return chrome_exec

    os.makedirs(target_dir, exist_ok=True)
    zip_path = os.path.join(base_dir, 'chromium_portable.zip')

    url = "https://github.com/ungoogled-software/ungoogled-chromium-windows/releases/download/150.0.7871.128-1.1/ungoogled-chromium_150.0.7871.128-1.1_windows_x64.zip"
    print(f"[Portable Engine] Downloading Portable Ungoogled Chromium from: {url}...")
    
    try:
        # Get total size first
        total_size = 0
        try:
            head_req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}, method='HEAD')
            with urllib.request.urlopen(head_req) as h_resp:
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
                    while True:
                        buffer = resp.read(block_size)
                        if not buffer:
                            break
                        downloaded += len(buffer)
                        out.write(buffer)
                        percent = int(downloaded * 100 / total_size) if total_size > 0 else 0
                        sys.stdout.write(f"\r[Portable Engine] Downloading: {percent}% ({downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB)")
                        sys.stdout.flush()
                
                if total_size > 0 and downloaded >= total_size:
                    break
            except Exception as retry_err:
                print(f"\n[Portable Engine Retry] Chunk failed ({retry_err}). Retrying attempt {attempt + 1}/{max_retries}...")
                import time
                time.sleep(2)

        print("\n[Portable Engine] Download completed! Extracting...")

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
                print(f"[Portable Engine] Portable Chromium successfully installed to: {chrome_exec}")

        if os.path.exists(zip_path):
            os.remove(zip_path)

        return chrome_exec
    except Exception as e:
        print(f"[Portable Engine Error] Failed to setup portable Chromium: {e}")
        return None

if __name__ == '__main__':
    download_and_setup_portable_chromium()
