const PI = Math.PI;
const rad = (d) => (d * PI) / 180;
const deg = (r) => (r * 180) / PI;
export const wrap = (v) => ((v % 1) + 1) % 1;
export function direction(lon, lat) {
  lon = rad(lon);
  lat = rad(lat);
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon),
  ];
}
export function uvFromDirection([x, y, z]) {
  return [
    wrap(Math.atan2(z, x) / (2 * PI)),
    Math.acos(Math.max(-1, Math.min(1, y))) / PI,
  ];
}
export function directionFromUV(u, v) {
  return direction(u * 360, 90 - v * 180);
}
export function parameters(zoom, lat) {
  const t = Math.max(0, Math.min(1, (30 - zoom) / 30));
  const blend = t * t * (3 - 2 * t);
  return {
    fov: rad(110 - Math.max(0, Math.min(1, (zoom - 30) / 70)) * 80),
    stereoFov: rad(110 + 190 * t),
    blend,
    lat: lat * (1 - blend) - 90 * blend,
  };
}
// Vision receives a rectilinear frame and must reproject against this exact snapshot.
export function subjectView(lon, lat, zoom, aspect) {
  const original = parameters(zoom, lat);
  const perspectiveZoom = Math.max(30, zoom);
  const perspectiveLat = zoom < 30 ? original.lat : lat;
  const projection = parameters(perspectiveZoom, perspectiveLat);
  return Object.freeze({
    lon,
    lat: perspectiveLat,
    zoom: perspectiveZoom,
    fov: deg(projection.fov),
    aspect,
  });
}
export function screenDirection(x, y, aspect, lon, lat, zoom) {
  const p = parameters(zoom, lat),
    lo = rad(lon),
    la = rad(p.lat),
    forward = direction(lon, p.lat),
    right = [-Math.sin(lo), 0, Math.cos(lo)],
    up = [
      -Math.sin(la) * Math.cos(lo),
      Math.cos(la),
      -Math.sin(la) * Math.sin(lo),
    ];
  const a = x * aspect,
    b = y,
    r = Math.hypot(a, b);
  if (!r) return forward;
  const theta =
    (1 - p.blend) * Math.atan(r * Math.tan(p.fov / 2)) +
    p.blend * 2 * Math.atan(r * Math.tan(p.stereoFov / 4));
  return forward.map(
    (v, i) =>
      v * Math.cos(theta) + ((right[i] * a + up[i] * b) / r) * Math.sin(theta),
  );
}
export function directionScreen(d, aspect, lon, lat, zoom) {
  const p = parameters(zoom, lat),
    lo = rad(lon),
    la = rad(p.lat),
    f = direction(lon, p.lat),
    right = [-Math.sin(lo), 0, Math.cos(lo)],
    up = [
      -Math.sin(la) * Math.cos(lo),
      Math.cos(la),
      -Math.sin(la) * Math.sin(lo),
    ],
    dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0),
    theta = Math.acos(Math.max(-1, Math.min(1, dot(d, f))));
  if (theta >= ((1 - p.blend) * PI) / 2 + p.blend * PI - 1e-10) return null;
  let low = 0,
    high = 1e4;
  for (let i = 0; i < 48; i++) {
    const m = (low + high) / 2,
      a =
        (1 - p.blend) * Math.atan(m * Math.tan(p.fov / 2)) +
        p.blend * 2 * Math.atan(m * Math.tan(p.stereoFov / 4));
    if (a < theta) low = m;
    else high = m;
  }
  const x = dot(d, right),
    y = dot(d, up),
    l = Math.hypot(x, y);
  return l ? [((x / l) * low) / aspect, (y / l) * low] : [0, 0];
}
export function angularDistance(a, b) {
  return deg(
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          a.reduce((v, x, i) => v + x * b[i], 0),
        ),
      ),
    ),
  );
}

export function fitDirections(points, aspect) {
  const sum = points.reduce((a, d) => a.map((v, i) => v + d[i]), [0, 0, 0]);
  const length = Math.hypot(...sum);
  if (length < 1e-8)
    throw Error("La selección está vacía o abarca direcciones incompatibles.");
  const f = sum.map((v) => v / length),
    lon = Math.atan2(f[2], f[0]),
    lat = Math.asin(f[1]);
  const right = [-Math.sin(lon), 0, Math.cos(lon)],
    up = [
      -Math.sin(lat) * Math.cos(lon),
      Math.cos(lat),
      -Math.sin(lat) * Math.sin(lon),
    ];
  const dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
  let extent = 0;
  for (const d of points) {
    const depth = dot(d, f);
    if (depth <= 0)
      throw Error(
        "La selección abarca direcciones incompatibles; divídela en máscaras.",
      );
    extent = Math.max(
      extent,
      Math.abs(dot(d, right) / depth) / aspect,
      Math.abs(dot(d, up) / depth),
    );
  }
  const fov = Math.max(25, deg(2 * Math.atan(extent * 1.15)));
  if (fov > 115)
    throw Error("La selección es demasiado amplia; divídela en máscaras.");
  return { lon: deg(lon), lat: deg(lat), fov, aspect };
}
