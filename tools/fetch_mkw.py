"""Download the arcade Mortal Kombat II sprites, arenas, HUD text, font and sounds
from Mortal Kombat Warehouse into raw/mkw/, plus a manifest of how the site groups
each fighter's frames (one list per <br/>-separated row of a sprite block).

Usage: python tools/fetch_mkw.py <project root>
Re-running skips files that are already on disk.
"""
import http.client
import json
import os
import re
import sys
import time
import urllib.parse

HOST = "www.mortalkombatwarehouse.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) mortal-hangman asset fetch"
FIGHTERS = ["liukang", "kunglao", "johnnycage", "reptile", "subzero", "shangtsung",
            "kitana", "jax", "mileena", "baraka", "scorpion", "raiden"]
ARENAS = ["kahnsarena", "kombattomb", "livingforest", "thearmory", "thedeadpool",
          "thepit2", "theportal", "thetower", "wasteland"]


class Site:
    def __init__(self):
        self.conn = None

    def get(self, path):
        for attempt in range(4):
            try:
                if self.conn is None:
                    self.conn = http.client.HTTPSConnection(HOST, timeout=60)
                self.conn.request("GET", urllib.parse.quote(path), headers={"User-Agent": UA})
                res = self.conn.getresponse()
                body = res.read()
                if res.status == 200:
                    return body
                if res.status == 404:
                    return None
                raise OSError(f"HTTP {res.status}")
            except (OSError, http.client.HTTPException) as err:
                print(f"  retry {path}: {err}", flush=True)
                self.conn = None
                time.sleep(1 + attempt * 2)
        raise OSError(f"giving up on {path}")


def save(site, path, dest):
    if os.path.exists(dest):
        return True
    try:
        body = site.get(path)
    except OSError as err:
        print(f"  failed {path}: {err}", flush=True)
        return False
    if body is None:
        print(f"  missing {path}", flush=True)
        return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(body)
    return True


def sprite_blocks(html):
    """{block id: [[frame path, ...] per row]} from a fighter's sprites page."""
    blocks = {}
    for m in re.finditer(r'<div class="block" id="([a-z0-9]+)">(.*?)Go Up', html, re.S):
        rows = []
        for chunk in re.split(r"<br\s*/?>", m.group(2)):
            frames = re.findall(r"<img src='([^']+\.(?:png|gif))'", chunk)
            if frames:
                rows.append(frames)
        if rows:
            blocks[m.group(1)] = rows
    return blocks


def image_list(html):
    return [s for s in re.findall(r"src='([^']+\.(?:png|gif))'", html) if not s.startswith("/")]


def main(root):
    raw = os.path.join(root, "raw", "mkw")
    site = Site()
    manifest = {"fighters": {}, "arenas": {}, "props": {}}

    for slug in FIGHTERS:
        html = site.get(f"/mk2/{slug}/sprites/").decode("utf-8", "replace")
        blocks = sprite_blocks(html)
        manifest["fighters"][slug] = blocks
        frames = [f for rows in blocks.values() for row in rows for f in row]
        print(f"{slug}: {len(blocks)} blocks, {len(frames)} frames", flush=True)
        for f in frames:
            save(site, f"/mk2/{slug}/sprites/{f}", os.path.join(raw, "fighters", slug, f))

    for arena in ARENAS:
        html = site.get(f"/mk2/arenas/{arena}/").decode("utf-8", "replace")
        imgs = image_list(html)
        manifest["arenas"][arena] = imgs
        print(f"arena {arena}: {len(imgs)} images", flush=True)
        for f in imgs:
            save(site, f"/mk2/arenas/{arena}/{f}", os.path.join(raw, "arenas", arena, f))

    html = site.get("/mk2/props/").decode("utf-8", "replace")
    imgs = image_list(html)
    manifest["props"] = imgs
    print(f"props: {len(imgs)} images", flush=True)
    for f in imgs:
        save(site, f"/mk2/props/{f}", os.path.join(raw, "props", f))

    save(site, "/site/fonts/mortalkombat2.ttf", os.path.join(raw, "fonts", "mortalkombat2.ttf"))
    save(site, "/site/fonts/mktitle.ttf", os.path.join(raw, "fonts", "mktitle.ttf"))
    save(site, "/mk2/sounds/mkw_mk2_sounds.zip", os.path.join(raw, "sounds", "mkw_mk2_sounds.zip"))

    with open(os.path.join(raw, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print("done", flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
