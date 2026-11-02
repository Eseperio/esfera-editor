#!/usr/bin/env python3
"""Experimental perspective-aware local fill; no network access."""

import sys, json, math, subprocess, tempfile, os
import cv2
import numpy as np

spec = json.loads(sys.argv[1])
src = cv2.imread(spec["image"], cv2.IMREAD_COLOR)
mask = cv2.imread(spec["mask"], cv2.IMREAD_UNCHANGED)
if src is None or mask is None or mask.ndim != 3 or mask.shape[2] != 4:
    raise ValueError("No se pudo cargar la imagen o la máscara.")
H, W = src.shape[:2]
mask = mask[:, :, 3]
mh, mw = mask.shape
lon = math.radians(spec["lon"])
lat = math.radians(spec["lat"])
fov = math.radians(spec["fov"])
aspect = spec["aspect"]
t = math.tan(fov / 2)
f = np.array(
    [math.cos(lat) * math.cos(lon), math.sin(lat), math.cos(lat) * math.sin(lon)]
)
r = np.array([-math.sin(lon), 0, math.cos(lon)])
u = np.cross(r, f)
# All selected points must be inside the current perspective, with margin for context.
small = cv2.resize(mask, (512, 256), interpolation=cv2.INTER_AREA)
yy, xx = np.nonzero(small > 40)
if len(xx) == 0:
    raise ValueError("La selección está vacía.")
phi = (xx + 0.5) * 2 * math.pi / 512
theta = (yy + 0.5) * math.pi / 256
v = np.column_stack(
    (np.cos(phi) * np.sin(theta), np.cos(theta), np.sin(phi) * np.sin(theta))
)
d = v @ f
sx = (v @ r) / np.maximum(d, 1e-9) / (t * aspect)
sy = -(v @ u) / np.maximum(d, 1e-9) / t
if np.any((d <= 0) | (np.abs(sx) > 0.94) | (np.abs(sy) > 0.94)):
    raise ValueError(
        "Sitúa toda la selección dentro de la vista, dejando margen alrededor, antes de aplicar."
    )
# Render a perspective view with enough surrounding pixels for line detection.
pw = max(1, min(1600, round(1600 * aspect)))
ph = max(1, round(pw / aspect))
X, Y = np.meshgrid(
    (np.arange(pw) + 0.5) / pw * 2 - 1, (np.arange(ph) + 0.5) / ph * 2 - 1
)
ray = (
    f[None, None, :]
    + X[:, :, None] * (t * aspect) * r[None, None, :]
    - Y[:, :, None] * t * u[None, None, :]
)
ray /= np.linalg.norm(ray, axis=2)[:, :, None]
mx = (
    np.mod(np.arctan2(ray[:, :, 2], ray[:, :, 0]), 2 * math.pi) * W / (2 * math.pi)
).astype(np.float32)
my = (np.arccos(np.clip(ray[:, :, 1], -1, 1)) * H / math.pi).astype(np.float32)
view = cv2.remap(src, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
vmask = (
    cv2.remap(
        mask, mx * (mw / W), my * (mh / H), cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP
    )
    > 32
)
# Local model receives only a square crop from the current perspective.
if spec.get("method") == "ai_local":
    ys, xs = np.nonzero(vmask)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    side = max(128, int(max(x1 - x0, y1 - y0) * 2.2))
    side = min(side, 4096)
    if max(x1 - x0, y1 - y0) > side:
        raise ValueError(
            "La selección es demasiado grande. Acércate y trabaja por zonas."
        )
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2
    left = cx - side // 2
    top = cy - side // 2
    pad = max(side, 1)
    padded = cv2.copyMakeBorder(view, pad, pad, pad, pad, cv2.BORDER_REFLECT_101)
    pmask = cv2.copyMakeBorder(
        vmask.astype(np.uint8) * 255, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0
    )
    crop = padded[top + pad : top + pad + side, left + pad : left + pad + side]
    cmask = pmask[top + pad : top + pad + side, left + pad : left + pad + side]
    if crop.shape[:2] != (side, side):
        raise ValueError("Centra la selección dejando más espacio alrededor.")
    image800 = cv2.resize(
        crop,
        (800, 800),
        interpolation=cv2.INTER_AREA if side > 800 else cv2.INTER_CUBIC,
    )
    mask800 = cv2.resize(cmask, (800, 800), interpolation=cv2.INTER_NEAREST)
    with tempfile.TemporaryDirectory(prefix="esfera-lama-") as td:
        ip = os.path.join(td, "image.png")
        mp = os.path.join(td, "mask.png")
        op = os.path.join(td, "result.png")
        cv2.imwrite(ip, image800)
        cv2.imwrite(mp, mask800)
        result = subprocess.run(
            [spec["runner"], spec["model"], ip, mp, op],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode:
            raise RuntimeError("Error de Core ML: " + result.stderr.strip())
        generated = cv2.imread(op, cv2.IMREAD_COLOR)
        if generated is None or generated.shape[:2] != (800, 800):
            raise RuntimeError("El modelo no ha devuelto una imagen válida.")
    patch = cv2.resize(generated, (side, side), interpolation=cv2.INTER_CUBIC)
    # Clip padded crop back to view; later blending restricts edits to the mask.
    ix0 = max(0, left)
    iy0 = max(0, top)
    ix1 = min(pw, left + side)
    iy1 = min(ph, top + side)
    filled = view.copy()
    filled[iy0:iy1, ix0:ix1] = patch[iy0 - top : iy1 - top, ix0 - left : ix1 - left]
    lines = []
    ok = np.zeros(len(xs), dtype=bool)
    n = len(xs)
else:
    # Ignore edges crossing the selected object. Prefer nearby, nonvertical segments.
    gray = cv2.cvtColor(view, cv2.COLOR_BGR2GRAY)
    detector = cv2.createLineSegmentDetector(0)
    detected = detector.detect(gray)[0]
    lines = []
    if detected is not None:
        for a, b, c, e in detected.reshape(-1, 4):
            dx = c - a
            dy = e - b
            length = math.hypot(dx, dy)
            if length < 22 or abs(dx) < 0.35 * length:
                continue
            steps = max(2, int(length / 5))
            xs = np.clip(np.linspace(a, c, steps).astype(int), 0, pw - 1)
            ys = np.clip(np.linspace(b, e, steps).astype(int), 0, ph - 1)
            if vmask[ys, xs].any():
                continue
            angle = math.atan2(dy, dx)
            angle = (angle + math.pi / 2) % math.pi - math.pi / 2
            lines.append((float(a), float(b), float(c), float(e), angle, length))
    lines.sort(key=lambda z: -z[5])
    lines = lines[:100]
    # Find the two closest line segments for each selected pixel and blend their
    # direction by distance. Separate angle buckets allow different regions.
    ys, xs = np.nonzero(vmask)
    coords = np.column_stack((xs, ys)).astype(np.float32)
    n = len(xs)
    best1 = np.full(n, np.inf)
    best2 = np.full(n, np.inf)
    ang1 = np.zeros(n)
    ang2 = np.zeros(n)
    for a, b, c, e, angle, length in lines:
        dx = c - a
        dy = e - b
        q = np.clip(
            ((coords[:, 0] - a) * dx + (coords[:, 1] - b) * dy) / (dx * dx + dy * dy),
            0,
            1,
        )
        dist = np.hypot(coords[:, 0] - (a + q * dx), coords[:, 1] - (b + q * dy))
        first = dist < best1
        best2[first] = best1[first]
        ang2[first] = ang1[first]
        best1[first] = dist[first]
        ang1[first] = angle
        second = (~first) & (dist < best2)
        best2[second] = dist[second]
        ang2[second] = angle
    angle = np.zeros(n)
    ok = best1 < max(pw, ph) * 0.30
    both = ok & np.isfinite(best2) & (best2 < max(pw, ph) * 0.30)
    angle[ok] = ang1[ok]
    angle[both] = (ang1[both] * best2[both] + ang2[both] * best1[both]) / (
        best1[both] + best2[both] + 1e-6
    )
    angle = np.clip(angle, -math.pi / 3, math.pi / 3)
    bucket_pos = angle / (math.pi / 12)
    lower = np.floor(bucket_pos).astype(int)
    upper = np.ceil(bucket_pos).astype(int)
    # Rotate the view so each direction becomes horizontal, interpolate selected
    # runs from neighbouring samples, then rotate the filled image back.
    filled = view.copy()
    center = (pw / 2, ph / 2)
    samples = max(1, min(50, int(spec.get("sample", 10))))
    accum = np.zeros((n, 3), np.float32)
    total = np.zeros(n, np.float32)
    for bucket in np.unique(np.concatenate((lower, upper))):
        deg = float(bucket * 15)
        M = cv2.getRotationMatrix2D(center, deg, 1)
        inv = cv2.invertAffineTransform(M)
        rotated = cv2.warpAffine(
            view, M, (pw, ph), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE
        )
        rm = (
            cv2.warpAffine(vmask.astype(np.uint8), M, (pw, ph), flags=cv2.INTER_NEAREST)
            > 0
        )
        out = rotated.copy()
        for y in np.flatnonzero(rm.any(axis=1)):
            row = rm[y]
            changes = np.diff(np.r_[False, row, False].astype(np.int8))
            starts = np.flatnonzero(changes == 1)
            ends = np.flatnonzero(changes == -1)
            for l, rend in zip(starts, ends):
                if l == 0 or rend >= pw:
                    continue
                left = rotated[y, max(0, l - samples) : l].mean(axis=0)
                right = rotated[y, rend : min(pw, rend + samples)].mean(axis=0)
                weights = np.linspace(0, 1, rend - l + 2, dtype=np.float32)[1:-1, None]
                out[y, l:rend] = np.clip(left * (1 - weights) + right * weights, 0, 255)
        back = cv2.warpAffine(
            out, inv, (pw, ph), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE
        )
        weights = np.maximum(0, 1 - np.abs(bucket_pos - bucket))
        group = weights > 0
        accum[group] += (
            back[ys[group], xs[group]].astype(np.float32) * weights[group, None]
        )
        total[group] += weights[group]
    filled[ys, xs] = np.clip(accum / np.maximum(total[:, None], 1e-8), 0, 255).astype(
        np.uint8
    )
    # Smooth only the interior of the repaired mask, preserving the joins to the original.
    center_smooth = max(0, min(30, int(spec.get("centerSmooth", 8))))
    if center_smooth:
        distance = cv2.distanceTransform(vmask.astype(np.uint8), cv2.DIST_L2, 3)
        amount = np.clip(distance / (center_smooth * 2), 0, 1)
        amount = amount * amount * (3 - 2 * amount)
        soft = cv2.GaussianBlur(filled, (0, 0), max(0.5, center_smooth / 2))
        mix = amount[ys, xs, None]
        filled[ys, xs] = np.clip(
            filled[ys, xs] * (1 - mix) + soft[ys, xs] * mix, 0, 255
        ).astype(np.uint8)
# Map the edited perspective back to the spherical panorama in row chunks.
# Work on the full image only for export; preview keeps original aspect ratio.
if spec.get("preview") and W > 4096:
    src = cv2.resize(src, (4096, round(H * 4096 / W)), interpolation=cv2.INTER_AREA)
    H, W = src.shape[:2]
mask = cv2.resize(mask, (W, H), interpolation=cv2.INTER_LINEAR)
feather = max(0, min(50, int(spec.get("feather", 8))))
feather = feather * (W / spec["width"])
alpha = cv2.GaussianBlur(mask, (0, 0), max(0.3, feather)) if feather else mask
layer = np.zeros((H, W, 4), dtype=np.uint8)
for top in range(0, H, 128):
    bottom = min(H, top + 128)
    yy, xx = np.mgrid[top:bottom, 0:W]
    phi = (xx + 0.5) * 2 * math.pi / W
    theta = (yy + 0.5) * math.pi / H
    vx = np.cos(phi) * np.sin(theta)
    vy = np.cos(theta)
    vz = np.sin(phi) * np.sin(theta)
    dot = vx * f[0] + vy * f[1] + vz * f[2]
    right = vx * r[0] + vy * r[1] + vz * r[2]
    up = vx * u[0] + vy * u[1] + vz * u[2]
    safe = np.maximum(dot, 1e-9)
    px = ((right / safe / (t * aspect) + 1) * pw / 2 - 0.5).astype(np.float32)
    py = ((1 - up / safe / t) * ph / 2 - 0.5).astype(np.float32)
    inside = (dot > 0) & (px >= 0) & (px < pw - 1) & (py >= 0) & (py < ph - 1)
    patch = cv2.remap(filled, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    layer[top:bottom, :, :3] = patch
    layer[top:bottom, :, 3] = (alpha[top:bottom] * inside).astype(np.uint8)
if not cv2.imwrite(spec["output"], layer, [cv2.IMWRITE_PNG_COMPRESSION, 3]):
    raise RuntimeError("No se pudo guardar la capa de edición.")
print(json.dumps({"lines": len(lines), "guided": int(ok.sum()), "selected": n}))
