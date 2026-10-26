"""Turn the raw MK Warehouse downloads (raw/mkw, from fetch_mkw.py) into what the game loads:
sprite atlases in assets/, sounds in assets/sounds/, and js/data/assets.js + js/data/fonts.js.

Usage: python tools/build_assets.py <project root>
"""
import base64
import json
import os
import re
import shutil
import sys
import zipfile

import numpy as np
from PIL import Image

ROSTER = {
    "liukang": ("LIU KANG", False, "0025", "0066"),
    "kunglao": ("KUNG LAO", False, "0024", "0085"),
    "johnnycage": ("JOHNNY CAGE", False, "0026", "0072"),
    "reptile": ("REPTILE", False, "0027", "0069"),
    "subzero": ("SUB-ZERO", False, "0023", "0068"),
    "shangtsung": ("SHANG TSUNG", False, "0021", "0071"),
    "kitana": ("KITANA", True, "0019", "0083"),
    "jax": ("JAX", False, "0020", "0089"),
    "mileena": ("MILEENA", True, "0018", "0090"),
    "baraka": ("BARAKA", False, "0029", "0084"),
    "scorpion": ("SCORPION", False, "0028", "0067"),
    "raiden": ("RAIDEN", False, "0022", "0070"),
}

# animation -> (sprite block, frame names or a regex the names must match), first match per row order
COMMON = {
    "stance": ("stance", r"^\d+$"),
    "walk": ("walk", r"^\d+$"),
    "punch": ("punch", ["01", "02", "03"]),
    "kick": ("kick", r"^\d+$"),
    "uppercut": ("punch", r"^u\d+$"),
    "hit": ("hit", r"^h\d+$"),
    "fall": ("fall", r"^f\d+$"),
    "dizzy": ("dizzy", r"^\d+$"),
    "victory": ("victory", r"^\d+$"),
    "fatality": [("finishers", r"^f1\d+$"), ("finishers", r"^f2\d+$"), ("punch", r"^u\d+$")],
}


def seq(a, b, width=3):
    return [str(i).zfill(width) for i in range(a, b + 1)]


# Each fighter's projectile special, read off the MK Warehouse special rows.
SPECIALS = {
    "liukang": dict(throw=["201", "301", "302"], proj=seq(401, 405)),
    "kunglao": dict(throw=seq(101, 105), proj=seq(114, 117), impact=seq(119, 120)),
    "johnnycage": dict(throw=seq(101, 106), proj=seq(160, 167), impact=seq(168, 173)),
    "reptile": dict(throw=seq(101, 103), proj=seq(104, 111), impact=seq(112, 116)),
    "subzero": dict(throw=seq(101, 104), proj=seq(108, 111), impact=seq(112, 116), freeze=True),
    "shangtsung": dict(throw=seq(101, 103), proj=seq(109, 112)),
    "kitana": dict(throw=seq(401, 406), proj=seq(106, 115)),
    "jax": dict(throw=seq(301, 311), proj=seq(312, 318), impact=seq(319, 322)),
    "mileena": dict(throw=["a" + n for n in seq(201, 209)], proj=seq(108, 115), impact=seq(116, 123)),
    "baraka": dict(throw=["101", "101a"] + seq(102, 105), proj=seq(106, 109), impact=seq(110, 116)),
    "scorpion": dict(throw=seq(101, 107), proj=["110"], spear=True),
    "raiden": dict(throw=seq(201, 204), proj=seq(211, 216), impact=seq(217, 222)),
}

# Arena animation: a key frame that is baked into the arena screenshot, found by pixel matching
# and painted out, then the frames cycled in its place. 'many' finds every copy of the key.
ARENA_ANIMS = {
    "livingforest": [dict(key="0676", frames=seq(676, 681, 4), fps=5, mode="pingpong", many=True)],
    "kahnsarena": [dict(key="0646", frames=["0646", "0761", "0762"], fps=6, mode="loop", many=True)],
    "thearmory": [dict(frames=seq(682, 692, 4), fps=12, mode="loop", at=[(128, 161), (234, 161), (340, 161)],
                       clip=[150, 186])],
    "thepit2": [dict(key="0641", frames=seq(693, 698, 4), fps=8, mode="loop"),
                dict(key="0642", frames=seq(699, 704, 4), fps=8, mode="loop")],
    "theportal": [dict(key="0644", frames=seq(720, 725, 4), fps=6, mode="pingpong", many=True),
                  dict(key="0648", frames=seq(763, 768, 4), fps=6, mode="pingpong", many=True)],
    "thetower": [dict(key="0644", frames=seq(720, 725, 4), fps=6, mode="pingpong")],
}
# Things that drift across or pop up in an arena rather than sit in one place.
ARENA_FLYERS = {
    "kombattomb": dict(frames=seq(705, 711, 4), fps=10, y=[18, 70], every=[3, 7]),
}
ARENA_BUBBLES = {
    "thedeadpool": dict(frames=seq(769, 774, 4) + seq(775, 780, 4), fps=10, y=[178, 196], every=[0.4, 1.4]),
}

PROP_GROUPS = {
    "text": ["0311", "0312", "0313", "0055", "0314", "0315"] + seq(108, 120, 4) + seq(56, 65, 4) + seq(66, 93, 4),
    "hud": seq(18, 31, 4) + ["0002", "0094", "0816"],
    "blood": None,  # everything in props/blood
    "gore": None,  # everything in props/bodyparts
    "fire": None,  # everything in props/fire
}


def load(path):
    im = Image.open(path)
    im.seek(0)
    return im.convert("RGBA")


class Packer:
    """Shelf packer into one atlas page."""

    def __init__(self, width=2048):
        self.width, self.items = width, []

    def add(self, key, im):
        self.items.append((key, im))

    def pack(self, out_png):
        order = sorted(range(len(self.items)), key=lambda i: -self.items[i][1].height)
        x = y = shelf = 0
        rects = {}
        for i in order:
            key, im = self.items[i]
            if x + im.width > self.width:
                x, y, shelf = 0, y + shelf + 1, 0
            rects[i] = (x, y)
            x += im.width + 1
            shelf = max(shelf, im.height)
        sheet = Image.new("RGBA", (self.width, y + shelf + 1), (0, 0, 0, 0))
        out = {}
        for i, (key, im) in enumerate(self.items):
            px, py = rects[i]
            sheet.alpha_composite(im, (px, py))
            out.setdefault(key, (px, py, im.width, im.height))
        os.makedirs(os.path.dirname(out_png), exist_ok=True)
        sheet.save(out_png, optimize=True)
        return out


def feet(im):
    """Leftmost and rightmost opaque columns in the bottom few rows: the back and front foot."""
    a = np.array(im)[:, :, 3] > 0
    rows = np.where(a.any(axis=1))[0]
    bottom = a[max(0, rows[-1] - 5): rows[-1] + 1].any(axis=0)
    cols = np.where(bottom)[0]
    return int(cols[0]), int(cols[-1])


def pick(blocks, block, names):
    rows = blocks.get(block, [])
    flat = []
    for row in rows:
        for f in row:
            base = os.path.basename(f).rsplit(".", 1)[0]
            if f.endswith(".gif") and re.search(r"a\d$", base):
                continue  # the site's animated previews (a1, 5a1, f1a1, sa1...)
            flat.append((base, f))
    if isinstance(names, list):
        lookup = {}
        for base, f in flat:
            if base not in lookup or f.endswith(".png"):
                lookup[base] = f
        return [lookup[n] for n in names if n in lookup]
    # Some frames exist as both .gif and .png; where they differ (Baraka's falls) the .png is the fighter.
    chosen = {}
    for base, f in flat:
        if re.match(names, base) and (base not in chosen or f.endswith(".png")):
            chosen[base] = f
    return list(chosen.values())


def build_fighter(root, raw, slug, manifest):
    blocks = manifest["fighters"][slug]
    base = os.path.join(raw, "fighters", slug)
    packer = Packer()
    anims = {}
    for anim, choices in COMMON.items():
        files = []
        for block, names in choices if isinstance(choices, list) else [choices]:
            files = files or pick(blocks, block, names)
        if not files:
            raise SystemExit(f"{slug}: no frames for {anim}")
        anims[anim] = files
    sp = SPECIALS[slug]
    for part in ("throw", "proj", "impact"):
        if sp.get(part):
            anims["sp_" + part] = pick(blocks, "special", sp[part])
            if len(anims["sp_" + part]) != len(sp[part]):
                raise SystemExit(f"{slug}: special {part} frames missing")
    anims["gibs"] = pick(blocks, "bodyparts", r".*")

    frames = {}
    for anim, files in anims.items():
        for f in files:
            im = load(os.path.join(base, f))
            packer.add(f, im)
            frames.setdefault(anim, []).append((f, im))
    rects = packer.pack(os.path.join(root, "assets", "fighters", slug + ".png"))
    # A fatality row mixes the fighter's own poses with effect frames (Sub-Zero's ice breath, fire,
    # sparks) that hold no fighter. Keep the poses as the fatality; the effects play on the victim.
    tall = frames["stance"][0][1].height * 0.55
    frames["fatality_fx"] = [(f, im) for f, im in frames["fatality"] if im.height < tall]
    frames["fatality"] = [(f, im) for f, im in frames["fatality"] if im.height >= tall]
    if not frames["fatality_fx"]:
        del frames["fatality_fx"]
    out = {}
    for anim, items in frames.items():
        out[anim] = []
        for f, im in items:
            x, y, w, h = rects[f]
            back, front = feet(im) if not anim.startswith(("sp_p", "sp_i", "gibs", "fatality_fx")) else (0, w - 1)
            out[anim].append([x, y, w, h, back, front])
    name, female, portrait, label = ROSTER[slug]
    return dict(name=name, female=female, portrait=portrait, label=label, image=f"assets/fighters/{slug}.png",
                anims=out, special=dict(freeze=bool(sp.get("freeze")), spear=bool(sp.get("spear"))))


def masked_ssd(img, tpl):
    """Sum of squared differences of tpl's opaque pixels against every placement in img."""
    H, W = img.shape[:2]
    h, w = tpl.shape[:2]
    m = (tpl[:, :, 3] > 0).astype(np.float64)
    t = tpl[:, :, :3].astype(np.float64)
    I = img[:, :, :3].astype(np.float64)
    shape = (H + h, W + w)

    def corr(a, b):
        fa = np.fft.rfft2(a, shape)
        fb = np.fft.rfft2(b[::-1, ::-1], shape)
        return np.fft.irfft2(fa * fb, shape)[h - 1:H, w - 1:W]

    total = np.full((H - h + 1, W - w + 1), (m[:, :, None] * t * t).sum())
    for c in range(3):
        total += corr(I[:, :, c] ** 2, m) - 2 * corr(I[:, :, c], m * t[:, :, c])
    return total / max(1.0, m.sum())


def find(img, tpls, many, limit):
    """Placements of the best-matching template (any frame, optionally mirrored) in img.
    Returns [(x, y, frame index, mirrored)]."""
    maps = []
    for i, tpl in enumerate(tpls):
        for flip in ((False, True) if many else (False,)):
            t = tpl[:, ::-1] if flip else tpl
            maps.append((masked_ssd(img, t), i, flip, t.shape[:2]))
    best = min(float(e.min()) for e, *_ in maps)
    if best > limit:
        return []
    if not many:
        e, i, flip, _ = min(maps, key=lambda m: float(m[0].min()))
        y, x = np.unravel_index(int(e.argmin()), e.shape)
        return [(int(x), int(y), i, flip)]
    cands = []
    for e, i, flip, (h, w) in maps:
        for y, x in zip(*np.where(e <= best * 1.6 + 150)):
            cands.append((float(e[y, x]), int(x), int(y), i, flip, w, h))
    hits = []
    for err, x, y, i, flip, w, h in sorted(cands):
        if all(abs(x - hx) > w // 2 or abs(y - hy) > h // 2 for _, hx, hy, *_ in hits):
            hits.append((err, x, y, i, flip))
    return [(x, y, i, flip) for _, x, y, i, flip in hits]


def inpaint(img, mask, iters=400):
    """Fill masked pixels by repeatedly averaging their neighbours."""
    out = img[:, :, :3].astype(np.float64)
    known = ~mask
    out[mask] = 0
    for _ in range(iters):
        acc = np.zeros_like(out)
        cnt = np.zeros(mask.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(out, (dy, dx), (0, 1))
            k = np.roll(known, (dy, dx), (0, 1))
            acc += sh * k[:, :, None]
            cnt += k
        fill = mask & (cnt > 0)
        out[fill] = acc[fill] / cnt[fill][:, None]
        known = known | fill
    res = img.copy()
    res[:, :, :3] = np.clip(out, 0, 255).astype(np.uint8)
    return res


def build_arena(root, raw, arena):
    props = os.path.join(raw, "arenas", arena, "props")
    img = np.array(load(os.path.join(raw, "arenas", "_composite", arena + ".png")))
    packer = Packer(1024)
    overlays, mask = [], np.zeros(img.shape[:2], bool)
    for spec in ARENA_ANIMS.get(arena, []):
        if "at" in spec:  # placed by eye: centre x and top y, drawn inside a clip band
            for f in spec["frames"]:
                packer.add(f, load(os.path.join(props, f + ".png")))
            for cx, top in spec["at"]:
                overlays.append(dict(frames=spec["frames"], cx=cx, top=top, fps=spec["fps"], mode=spec["mode"],
                                     clip=spec["clip"]))
            continue
        names = [spec["key"]] + spec["frames"]
        tpls = [np.array(load(os.path.join(props, f + ".png"))) for f in names]
        hits = find(img, tpls, spec.get("many"), spec.get("limit", 2500))
        print(f"  {arena} {spec['key']}: {hits}")
        if not hits:
            continue
        for f in spec["frames"]:
            packer.add(f, load(os.path.join(props, f + ".png")))
        for x, y, i, flip in hits:
            key = tpls[i][:, ::-1] if flip else tpls[i]
            kh, kw = key.shape[:2]
            mask[y:y + kh, x:x + kw] |= key[:, :, 3] > 0
            overlays.append(dict(frames=spec["frames"], cx=x + kw / 2, bottom=y + kh, fps=spec["fps"],
                                 mode=spec["mode"], flip=flip))
    flyer, bubbles = ARENA_FLYERS.get(arena), ARENA_BUBBLES.get(arena)
    for extra in (flyer, bubbles):
        for f in (extra or {}).get("frames", []):
            packer.add(f, load(os.path.join(props, f + ".png")))
    if mask.any():
        grown = mask.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            grown |= np.roll(mask, (dy, dx), (0, 1))
        img = inpaint(img, grown)
    Image.fromarray(img).convert("RGB").save(os.path.join(root, "assets", "arenas", arena + ".png"), optimize=True)
    rects = packer.pack(os.path.join(root, "assets", "arenas", arena + "_anim.png")) if packer.items else {}
    for o in overlays:
        o["frames"] = [list(rects[f]) for f in o["frames"]]
    out = dict(image=f"assets/arenas/{arena}.png", overlays=overlays)
    if rects:
        out["anim"] = f"assets/arenas/{arena}_anim.png"
    if flyer:
        out["flyer"] = dict(flyer, frames=[list(rects[f]) for f in flyer["frames"]])
    if bubbles:
        out["bubbles"] = dict(bubbles, frames=[list(rects[f]) for f in bubbles["frames"]])
    return out


def build_props(root, raw):
    packer = Packer()
    groups = {}
    folders = {"text": "text", "hud": "hud", "blood": "blood", "gore": "bodyparts", "fire": "fire"}
    for group, ids in PROP_GROUPS.items():
        folder = os.path.join(raw, "props", folders[group])
        names = ids or sorted(n.rsplit(".", 1)[0] for n in os.listdir(folder) if n.endswith(".png"))
        names = [n for n in names if os.path.exists(os.path.join(folder, n + ".png"))]
        groups[group] = names
        for n in names:
            packer.add(f"{group}/{n}", load(os.path.join(folder, n + ".png")))
    rects = packer.pack(os.path.join(root, "assets", "props.png"))
    items = {}
    for g, names in groups.items():
        items[g] = {}
        for n in names:
            # MK Warehouse writes a frame's drawing offset into its name: 0163[Y+20], 0235[X-40].
            off = {k: int(v) for k, v in re.findall(r"\[([XY])([+-]\d+)\]", n)}
            items[g][n.split("[")[0].split(" ")[0]] = list(rects[f"{g}/{n}"]) + [off.get("X", 0), off.get("Y", 0)]
    return dict(image="assets/props.png", items=items)


def build_sounds(root, raw):
    dest = os.path.join(root, "assets", "sounds")
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    with zipfile.ZipFile(os.path.join(raw, "sounds", "mkw_mk2_sounds.zip")) as z:
        names = [n for n in z.namelist() if n.endswith(".mp3")]
        for n in names:
            os.makedirs(os.path.join(dest, os.path.dirname(n)), exist_ok=True)
            with open(os.path.join(dest, n), "wb") as f:
                f.write(z.read(n))
    groups = {}
    for n in sorted(names):
        groups.setdefault(os.path.dirname(n), []).append(os.path.basename(n).rsplit(".", 1)[0])
    return groups


def build_fonts(root, raw):
    lines = ["// MK2 fonts as data URIs so they load from file:// too. Generated by tools/build_assets.py"]
    lines.append("(function () {")
    lines.append("  const css = [];")
    for family, f in (("MK2", "mortalkombat2.ttf"), ("MKTitle", "mktitle.ttf")):
        data = base64.b64encode(open(os.path.join(raw, "fonts", f), "rb").read()).decode()
        lines.append(f"  css.push(\"@font-face{{font-family:'{family}';src:url(data:font/ttf;base64,{data}) format('truetype');}}\");")
    lines.append("  const s = document.createElement('style');")
    lines.append("  s.textContent = css.join('\\n');")
    lines.append("  document.head.appendChild(s);")
    lines.append("})();")
    open(os.path.join(root, "js", "data", "fonts.js"), "w").write("\n".join(lines) + "\n")


def main(root):
    raw = os.path.join(root, "raw", "mkw")
    manifest = json.load(open(os.path.join(raw, "manifest.json")))
    os.makedirs(os.path.join(root, "assets", "arenas"), exist_ok=True)
    os.makedirs(os.path.join(root, "js", "data"), exist_ok=True)
    data = dict(fighters={}, arenas={})
    for slug in ROSTER:
        data["fighters"][slug] = build_fighter(root, raw, slug, manifest)
        print(f"{slug}: " + ", ".join(f"{k} {len(v)}" for k, v in data["fighters"][slug]["anims"].items()))
    for arena in sorted(os.listdir(os.path.join(raw, "arenas"))):
        if not arena.startswith("_"):
            data["arenas"][arena] = build_arena(root, raw, arena)
    data["props"] = build_props(root, raw)
    data["sounds"] = build_sounds(root, raw)
    build_fonts(root, raw)
    with open(os.path.join(root, "js", "data", "assets.js"), "w") as f:
        f.write("// Generated by tools/build_assets.py from MK Warehouse's Mortal Kombat II rips.\n")
        f.write("window.ASSETS = " + json.dumps(data, separators=(",", ":")) + ";\n")
    print("done")


if __name__ == "__main__":
    main(sys.argv[1])
