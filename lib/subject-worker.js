self.onmessage = async ({ data }) => {
  try {
    const raw = atob(data.mask.slice(data.mask.indexOf(",") + 1)),
      bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
    );
    const source = new OffscreenCanvas(bitmap.width, bitmap.height),
      ctx = source.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const w = 2048,
      h = 1024,
      result = new Uint8ClampedArray(w * h * 4),
      lon = (data.lon * Math.PI) / 180,
      lat = (data.lat * Math.PI) / 180,
      t = Math.tan((data.fov * Math.PI) / 360),
      f = [
        Math.cos(lat) * Math.cos(lon),
        Math.sin(lat),
        Math.cos(lat) * Math.sin(lon),
      ],
      r = [-Math.sin(lon), 0, Math.cos(lon)],
      u = [
        -Math.sin(lat) * Math.cos(lon),
        Math.cos(lat),
        -Math.sin(lat) * Math.sin(lon),
      ];
    let count = 0;
    for (let y = 0; y < h; y++) {
      const phi = (Math.PI * (y + 0.5)) / h,
        sy = Math.cos(phi),
        sr = Math.sin(phi);
      for (let x = 0; x < w; x++) {
        const theta = (2 * Math.PI * (x + 0.5)) / w,
          dx = sr * Math.cos(theta),
          dz = sr * Math.sin(theta),
          depth = dx * f[0] + sy * f[1] + dz * f[2];
        if (depth <= 0) continue;
        const nx = (dx * r[0] + dz * r[2]) / depth / t / data.aspect,
          ny = (dx * u[0] + sy * u[1] + dz * u[2]) / depth / t;
        if (Math.abs(nx) > 1 || Math.abs(ny) > 1) continue;
        const px = Math.min(
            bitmap.width - 1,
            Math.floor((nx + 1) * 0.5 * bitmap.width),
          ),
          py = Math.min(
            bitmap.height - 1,
            Math.floor((1 - ny) * 0.5 * bitmap.height),
          ),
          p = (py * bitmap.width + px) * 4,
          alpha = pixels[p];
        if (alpha > 16) {
          const i = (y * w + x) * 4;
          result[i] = 255;
          result[i + 1] = 65;
          result[i + 2] = 130;
          result[i + 3] = alpha;
          count++;
        }
      }
    }
    postMessage({ buffer: result.buffer, width: w, height: h, count }, [
      result.buffer,
    ]);
  } catch (e) {
    postMessage({ error: e.message });
  }
};
