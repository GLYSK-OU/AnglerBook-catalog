#!/usr/bin/env bash
# Pull brand logos into catalog/logos/ using the domain map in gear.json.
# Best-effort source chain; replace low-res files with curated assets as needed.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - "$@" <<'PY'
import json,subprocess,os,re
d=json.load(open("catalog/gear.json"))
def slug(s): return re.sub(r"-+","-",re.sub(r"[^a-z0-9]+","-",s.lower())).strip("-")
seen={}
for k in d["kinds"]:
    for b in k["brands"]:
        lg=b.get("logo") or {}
        if lg.get("domain"): seen[b["brand"]]=lg["domain"]
os.makedirs("catalog/logos",exist_ok=True)
for name,dom in sorted(seen.items()):
    s=slug(name); out=f"catalog/logos/{s}.png"
    for url in (f"https://{dom}/apple-touch-icon.png",
                f"https://{dom}/apple-touch-icon-precomposed.png",
                f"https://unavatar.io/{dom}"):
        r=subprocess.run(["curl","-sL","-m","10","-o",out,url])
        if r.returncode==0 and os.path.exists(out) and os.path.getsize(out)>700:
            print(f"{s:<22} {dom:<24} <- {url}"); break
    else:
        print(f"{s:<22} {dom:<24} FAILED")
PY
