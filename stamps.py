#!/usr/bin/env python3
"""Apply spherical tangent-plane stamps in bands to an equirectangular raster."""

import json, sys, math
import cv2
import numpy as np

spec = json.loads(sys.argv[1])
image = cv2.imread(spec["image"], cv2.IMREAD_COLOR)
if image is None:
    raise ValueError("Cannot read panorama")
h, w = image.shape[:2]
for stamp in spec["stamps"]:
    if not stamp.get("enabled", True):
        continue
    lon = math.radians(stamp["lon"])
    lat = math.radians(stamp["lat"])
    radius = math.radians(stamp["size"] / 2)
    rotation = math.radians(stamp["rotation"])
    scale = stamp["scale"]
    ox = stamp["offsetX"]
    oy = stamp["offsetY"]
    f = np.array(
        [math.cos(lat) * math.cos(lon), math.sin(lat), math.cos(lat) * math.sin(lon)]
    )
    r = np.array([-math.sin(lon), 0, math.cos(lon)])
    u = np.cross(r, f)
    asset = (
        cv2.imread(stamp["path"], cv2.IMREAD_UNCHANGED) if stamp.get("path") else None
    )
    if asset is not None:
        if asset.ndim == 2:
            asset = cv2.cvtColor(asset, cv2.COLOR_GRAY2BGRA)
        elif asset.shape[2] == 3:
            asset = cv2.cvtColor(asset, cv2.COLOR_BGR2BGRA)
        ah, aw = asset.shape[:2]
        aspect = aw / ah
        iw = min(1.0, aspect)
        ih = min(1.0, 1 / aspect)
    theta = (np.arange(w, dtype=np.float32) + 0.5) * 2 * math.pi / w
    coslon = np.cos(theta)[None, :]
    sinlon = np.sin(theta)[None, :]
    for top in range(0, h, 128):
        bottom = min(h, top + 128)
        phi = (np.arange(top, bottom, dtype=np.float32) + 0.5) * math.pi / h
        sy = np.cos(phi)[:, None]
        sr = np.sin(phi)[:, None]
        dx = sr * coslon
        dz = sr * sinlon
        depth = dx * f[0] + sy * f[1] + dz * f[2]
        safe = np.maximum(depth, 1e-8) * math.tan(radius)
        x = (dx * r[0] + dz * r[2]) / safe
        y = (dx * u[0] + sy * u[1] + dz * u[2]) / safe
        support = (depth > 0) & (
            (x * x + y * y <= 1)
            if stamp["circle"]
            else ((np.abs(x) <= 1) & (np.abs(y) <= 1))
        )
        if not np.any(support):
            continue
        if asset is None:
            alpha = support.astype(np.float32)
            colors = np.zeros((*alpha.shape, 3), dtype=np.float32)
            colors[:] = stamp["color"]
        else:
            xx = (x * math.cos(rotation) + y * math.sin(rotation) - ox) / scale
            yy = (-x * math.sin(rotation) + y * math.cos(rotation) - oy) / scale
            mx = ((xx / iw + 1) * 0.5 * (aw - 1)).astype(np.float32)
            my = ((1 - yy / ih) * 0.5 * (ah - 1)).astype(np.float32)
            sampled = cv2.remap(
                asset,
                mx,
                my,
                cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_CONSTANT,
                borderValue=(0, 0, 0, 0),
            )
            alpha = (sampled[:, :, 3].astype(np.float32) / 255) * support
            colors = sampled[:, :, :3].astype(np.float32)
        region = image[top:bottom]
        active = alpha > 0
        region[active] = np.clip(
            region[active] * (1 - alpha[active, None])
            + colors[active] * alpha[active, None],
            0,
            255,
        ).astype(np.uint8)
if not cv2.imwrite(spec["output"], image):
    raise RuntimeError("Cannot write output")
