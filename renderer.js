import * as THREE from "./node_modules/three/build/three.module.js";
import { t, setLanguage, language, translateLive } from "./lib/i18n.mjs";
import { setOpenFeedback } from "./lib/open-feedback.mjs";
import { bindRange } from "./lib/controls.mjs";
import {
  launchVelocity,
  integrateVelocity,
  normalizeWheel,
} from "./lib/navigation.mjs";
import {
  screenDirection,
  directionScreen,
  uvFromDirection,
  parameters,
  angularDistance,
  fitDirections,
  subjectView,
} from "./lib/projection.mjs";
document.getElementById("language").value = setLanguage(language());
window.editor.setLanguage(language());
document.getElementById("language").onchange = (e) => {
  setLanguage(e.target.value);
  window.editor.setLanguage(e.target.value);
  showInfo();
  const statusNode = document.getElementById("status");
  statusNode.textContent = translateLive(statusNode.textContent);
  renderMasks();
  stampUI();
  syncRangeControls();
};
const $ = (id) => document.getElementById(id),
  viewer = $("viewer"),
  status = $("status");
const scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000),
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
viewer.appendChild(renderer.domElement);
const geo = new THREE.PlaneGeometry(2, 2),
  screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
let sphere;
const ray = new THREE.Raycaster(),
  pointer = new THREE.Vector2();
let lon = 0,
  lat = 0,
  mode = "navigate",
  drag = false,
  last = null,
  previous = null,
  loaded = false;
let velocityLon = 0,
  velocityLat = 0,
  lastMoveTime = 0,
  lastFrameTime = 0,
  motionSamples = [],
  dragDistance = 0,
  lastDirection = { x: 0, y: 0 },
  targetFov = 70,
  zoomValue = 65,
  targetZoom = 65;
function stopInertia() {
  velocityLon = 0;
  velocityLat = 0;
  lastMoveTime = 0;
  motionSamples = [];
}
const mask = document.createElement("canvas");
mask.width = 4096;
mask.height = 2048;
const mc = mask.getContext("2d");
let overlay,
  originalTexture,
  selected = false,
  previewTexture = null,
  busy = false;
let strokes = [],
  history = [],
  activeStroke = null;
let masks = [],
  activeMask = 0,
  stamps = [],
  activeStamp = 0,
  imageInfo = {},
  brushPoint = null,
  brushUntil = 0;
function showInfo() {
  const list = $("imageInfo"),
    term = $("infoSearch").value.toLowerCase();
  list.replaceChildren();
  if (!imageInfo.name) return;
  const groups = {
    Archivo: [],
    Cámara: [],
    Captura: [],
    Ubicación: [],
    "Color y orientación": [],
    Panorama: [],
    Otros: [],
  };
  const add = (group, key, value) => {
    if (value !== undefined && value !== null && value !== "")
      groups[group].push([key, String(value)]);
  };
  const info = imageInfo;
  add("Archivo", "Nombre", info.name);
  add("Archivo", "Formato", info.format?.toUpperCase());
  add(
    "Archivo",
    "Tamaño",
    `${(info.bytes / 1048576).toFixed(2)} MiB (${info.bytes} bytes)`,
  );
  add("Archivo", "Dimensiones", `${info.width} × ${info.height}`);
  add(
    "Archivo",
    "Resolución",
    `${((info.width * info.height) / 1000000).toFixed(2)} MP`,
  );
  add(
    "Archivo",
    "Textura del visor",
    `${info.previewWidth} × ${Math.round(info.previewWidth / 2)}`,
  );
  add("Archivo", "Vista previa aplicada", info.appliedPreview);
  add(
    "Color y orientación",
    "Exportación",
    t(
      "Conversión gestionada a sRGB; los colores fuera de gama pueden recortarse.",
    ),
  );
  add("Color y orientación", "Espacio de color", info.space);
  add("Color y orientación", "Orientación", info.orientation);
  if (
    !Object.keys(info.blocks || {}).length &&
    !Object.keys(info.tags || {}).length
  )
    add("Otros", "Metadatos", t("Sin metadatos"));
  for (const [key, size] of Object.entries(info.blocks || {}))
    add("Otros", `${key.toUpperCase()} ${t("bloque")}`, `${size} bytes`);
  const labels = {
    Make: "Fabricante",
    Model: "Modelo",
    LensModel: "Objetivo",
    LensMake: "Fabricante de objetivo",
    DateTimeOriginal: "Fecha de captura",
    CreateDate: "Fecha de creación",
    ExposureTime: "Tiempo de exposición",
    FNumber: "Apertura",
    FocalLength: "Distancia focal",
    ISO: "ISO",
    latitude: "Latitud",
    longitude: "Longitud",
    GPSLatitude: "Latitud GPS",
    GPSLongitude: "Longitud GPS",
    GPSAltitude: "Altitud GPS",
    ProjectionType: "Tipo de proyección",
    UsePanoramaViewer: "Visor panorámico",
    ProfileDescription: "Perfil de color",
    Orientation: "Orientación",
  };
  const camera = new Set([
    "Make",
    "Model",
    "LensMake",
    "LensModel",
    "LensSpecification",
  ]);
  const capture = new Set([
    "DateTimeOriginal",
    "CreateDate",
    "ExposureTime",
    "FNumber",
    "FocalLength",
    "ISO",
    "ShutterSpeedValue",
    "ApertureValue",
    "ExposureBiasValue",
    "Flash",
  ]);
  for (const [key, value] of Object.entries(info.tags || {})) {
    const group = camera.has(key)
      ? "Cámara"
      : capture.has(key)
        ? "Captura"
        : /^(GPS|latitude|longitude)/i.test(key)
          ? "Ubicación"
          : /^(GPano|Projection|UsePanorama|CroppedArea|FullPano)/i.test(key)
            ? "Panorama"
            : /^(Profile|Color|Orientation|Rendering|MediaWhite|Chromatic|Red|Green|Blue)/i.test(
                  key,
                )
              ? "Color y orientación"
              : "Otros";
    let shown = Array.isArray(value)
      ? value.join(", ")
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
    add(group, labels[key] || key, shown?.slice(0, 1000));
  }
  for (const [group, rows] of Object.entries(groups)) {
    const filtered = rows.filter(([key, value]) =>
      `${key} ${t(key)} ${value}`.toLowerCase().includes(term),
    );
    if (!filtered.length) continue;
    const heading = document.createElement("dt");
    heading.className = "info-group";
    heading.textContent = t(group);
    list.append(heading);
    for (const [key, value] of filtered) {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = t(key);
      dd.textContent = value;
      list.append(dt, dd);
    }
  }
}
$("infoSearch").oninput = showInfo;
const rangeControls = new Map();
function syncRangeControls() {
  for (const binding of rangeControls.values()) {
    binding.sync();
    binding.number.setAttribute("aria-label", t(binding.label));
  }
}
const contour = document.createElement("canvas");
contour.className = "stamp-contour";
viewer.appendChild(contour);
function selectedStamp() {
  return stamps[activeStamp];
}
function drawBrushContour(ctx, w, h) {
  if (
    !["paint", "erase"].includes(mode) ||
    (!brushPoint && performance.now() > brushUntil)
  )
    return;
  const p = brushPoint || {
      clientX: renderer.domElement.getBoundingClientRect().left + w / 2,
      clientY: renderer.domElement.getBoundingClientRect().top + h / 2,
    },
    center = point(p),
    lo = (center.x / mask.width) * Math.PI * 2,
    la = Math.PI / 2 - (center.y / mask.height) * Math.PI,
    f = [
      Math.cos(la) * Math.cos(lo),
      Math.sin(la),
      Math.cos(la) * Math.sin(lo),
    ],
    r = [-Math.sin(lo), 0, Math.cos(lo)],
    up = [
      -Math.sin(la) * Math.cos(lo),
      Math.cos(la),
      -Math.sin(la) * Math.sin(lo),
    ];
  ctx.beginPath();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  let started = false;
  for (let i = 0; i <= 96; i++) {
    const a = (i * Math.PI * 2) / 96,
      d = f.map(
        (v, j) =>
          v * Math.cos(center.r) +
          (r[j] * Math.cos(a) + up[j] * Math.sin(a)) * Math.sin(center.r),
      ),
      v = directionScreen(d, camera.aspect, lon, lat, zoomValue);
    if (!v || Math.abs(v[0]) > 2 || Math.abs(v[1]) > 2) {
      started = false;
      continue;
    }
    const x = ((v[0] + 1) * w) / 2,
      y = ((1 - v[1]) * h) / 2;
    if (started) ctx.lineTo(x, y);
    else {
      ctx.moveTo(x, y);
      started = true;
    }
  }
  ctx.stroke();
}
const stampPreviewImages = new Map();
function drawStampPreview() {
  const canvas = $("stampPreview"),
    stamp = selectedStamp();
  canvas.hidden = !stamp;
  if (!stamp) return;
  const ctx = canvas.getContext("2d"),
    side = canvas.width,
    half = side / 2;
  ctx.clearRect(0, 0, side, side);
  ctx.save();
  ctx.beginPath();
  if (stamp.circle) ctx.arc(half, half, half, 0, Math.PI * 2);
  else ctx.rect(0, 0, side, side);
  ctx.clip();
  if (!stamp.preview) {
    ctx.fillStyle = stamp.color || "#ffffff";
    ctx.fillRect(0, 0, side, side);
    ctx.restore();
    return;
  }
  let image = stampPreviewImages.get(stamp.preview);
  if (!image) {
    image = new Image();
    stampPreviewImages.set(stamp.preview, image);
    image.onload = drawStampPreview;
    image.src = "data:image/png;base64," + stamp.preview;
  }
  if (image.complete && image.naturalWidth) {
    const aspect = image.naturalWidth / image.naturalHeight,
      w = side * Math.min(1, aspect),
      h = side * Math.min(1, 1 / aspect);
    ctx.translate(half, half);
    ctx.rotate((-stamp.rotation * Math.PI) / 180);
    ctx.translate(stamp.offsetX * half, -stamp.offsetY * half);
    ctx.scale(stamp.scale, stamp.scale);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}
function stampUI() {
  const s = selectedStamp();
  $("stampList").replaceChildren();
  stamps.forEach((stamp, i) => {
    const b = document.createElement("button");
    b.textContent = t("Sello") + " " + (i + 1);
    b.className = i === activeStamp ? "active" : "";
    b.onclick = () => {
      activeStamp = i;
      stampUI();
    };
    $("stampList").append(b);
  });
  for (const [id, key] of [
    ["stampSize", "size"],
    ["stampRotation", "rotation"],
    ["stampScale", "scale"],
    ["stampX", "offsetX"],
    ["stampY", "offsetY"],
  ]) {
    $(id).disabled = !s;
    if (s) {
      $(id).value = s[key];
      $(id + "Value").textContent = s[key];
    }
  }
  for (const [id, key] of [
    ["stampCircle", "circle"],
    ["stampEnabled", "enabled"],
  ]) {
    $(id).disabled = !s;
    if (s) $(id).checked = s[key];
  }
  $("stampSettings").hidden = !s;
  $("stampColor").disabled = !s;
  if (s) {
    $("stampColor").value = s.color || "#ffffff";
    $("stampHex").value = $("stampColor").value.toUpperCase();
  }
  for (const id of [
    "importStamp",
    "removeStamp",
    "stampTop",
    "stampBottom",
    "stampHere",
    "stampCenter",
  ])
    $(id).disabled = !s;
  drawStampPreview();
  syncRangeControls();
}
function drawContour() {
  const ctx = contour.getContext("2d"),
    w = viewer.clientWidth,
    h = viewer.clientHeight;
  if (contour.width !== w || contour.height !== h) {
    contour.width = w;
    contour.height = h;
  }
  ctx.clearRect(0, 0, w, h);
  if (!loaded || busy) return;
  drawBrushContour(ctx, w, h);
  const s = selectedStamp();
  if (!s || !$("stampsSection").open) return;
  const lo = (s.lon * Math.PI) / 180,
    la = (s.lat * Math.PI) / 180,
    f = [
      Math.cos(la) * Math.cos(lo),
      Math.sin(la),
      Math.cos(la) * Math.sin(lo),
    ],
    r = [-Math.sin(lo), 0, Math.cos(lo)],
    up = [
      -Math.sin(la) * Math.cos(lo),
      Math.cos(la),
      -Math.sin(la) * Math.sin(lo),
    ],
    radius = Math.tan((s.size * Math.PI) / 360);
  ctx.strokeStyle = "#ff5368";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= 128; i++) {
    const a = (i * Math.PI * 2) / 128,
      scale = s.circle
        ? 1
        : 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))),
      d = f.map(
        (x, j) =>
          x + radius * scale * (r[j] * Math.cos(a) + up[j] * Math.sin(a)),
      ),
      n = Math.hypot(...d),
      p = directionScreen(
        d.map((x) => x / n),
        camera.aspect,
        lon,
        lat,
        zoomValue,
      );
    if (!p || Math.abs(p[0]) > 2 || Math.abs(p[1]) > 2) {
      started = false;
      continue;
    }
    const x = ((p[0] + 1) * w) / 2,
      y = ((1 - p[1]) * h) / 2;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function saveMask() {
  if (!masks[activeMask]) return;
  Object.assign(masks[activeMask], {
    strokes,
    method: $("method").value,
    settings: Object.fromEntries(
      ["blur", "offset", "sample", "centerSmooth", "feather"].map((id) => [
        id,
        $(id).value,
      ]),
    ),
  });
}
function loadMask(index, shouldSave = true) {
  if (shouldSave) saveMask();
  activeMask = index;
  const m = masks[index];
  strokes = m.strokes;
  $("method").value = m.method;
  for (const [id, value] of Object.entries(m.settings)) {
    $(id).value = value;
    $(id + "Value").textContent = value;
  }
  redrawMask();
  updateMethodControls();
  renderMasks();
  syncRangeControls();
}
function newMask() {
  return {
    id: crypto.randomUUID(),
    name: t("Máscara") + " " + (masks.length + 1),
    enabled: true,
    strokes: [],
    method: "guided",
    settings: { blur: 30, offset: 10, sample: 10, centerSmooth: 8, feather: 8 },
  };
}
function renderMasks() {
  $("maskList").replaceChildren();
  masks.forEach((m, i) => {
    const row = document.createElement("div");
    row.className = "mask-row" + (i === activeMask ? " active" : "");
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = m.enabled;
    enabled.title = t("Activar efecto");
    enabled.onchange = () => {
      snapshot();
      m.enabled = enabled.checked;
      invalidate();
    };
    const name = document.createElement("button");
    name.textContent = m.name;
    name.onclick = () => loadMask(i);
    name.ondblclick = () => {
      const next = prompt(t("Nombre de la máscara"), m.name);
      if (next?.trim()) {
        snapshot();
        m.name = next.trim().slice(0, 80);
        renderMasks();
      }
    };
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.title = t("Eliminar máscara");
    remove.onclick = () => {
      snapshot();
      masks.splice(i, 1);
      if (!masks.length) masks.push(newMask());
      activeMask = Math.min(activeMask, masks.length - 1);
      loadMask(activeMask, false);
      invalidate(true);
    };
    row.append(enabled, name, remove);
    $("maskList").append(row);
  });
}
$("addMask").onclick = () => {
  snapshot();
  masks.push(newMask());
  loadMask(masks.length - 1);
  invalidate(true);
};
function setBusy(value, message = "") {
  busy = value;
  document.querySelector("main").inert = value;
  document.querySelector(".topbar").inert = value;
  document.body.setAttribute("aria-busy", String(value));
  $("processing").hidden = !value;
  if (value) {
    stopDrag();
    targetZoom = zoomValue;
    $("zoomSlider").value = String(Math.round(targetZoom));
    syncRangeControls();
    $("processingText").textContent = message;
  }
}
function copyStrokes(items) {
  return items.map((s) =>
    s.kind === "subject"
      ? s
      : {
          width: s.width,
          erase: s.erase,
          points: s.points.map((p) => ({ ...p })),
        },
  );
}
function snapshot() {
  saveMask();
  history.push({
    masks: masks.map((m) => ({
      ...m,
      settings: { ...m.settings },
      strokes: copyStrokes(m.strokes),
    })),
    activeMask,
    stamps: stamps.map((s) => ({ ...s })),
    activeStamp,
  });
  if (history.length > 50) history.shift();
  $("undo").disabled = false;
}
function redrawMask() {
  mc.clearRect(0, 0, mask.width, mask.height);
  for (const line of strokes) {
    mc.globalCompositeOperation = line.erase
      ? "destination-out"
      : "source-over";
    if (line.kind === "subject")
      mc.drawImage(line.image, 0, 0, mask.width, mask.height);
    else
      for (let i = 0; i < line.points.length; i++)
        stroke(line.points[Math.max(0, i - 1)], line.points[i], line.width);
  }
  mc.globalCompositeOperation = "source-over";
  selected = strokes.length > 0;
  if (overlay) overlay.needsUpdate = true;
}
function undo() {
  if (busy || !history.length) return;
  stopDrag();
  const state = history.pop();
  masks = state.masks;
  activeMask = state.activeMask;
  stamps = state.stamps;
  activeStamp = state.activeStamp;
  loadMask(activeMask, false);
  stampUI();
  $("undo").disabled = history.length === 0;
  invalidate(true);
  status.textContent = t("Última operación deshecha.");
}
$("undo").onclick = undo;
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
});
function invalidate(editSelection = false) {
  if (!loaded) return;
  $("export").disabled = true;
  if (editSelection) {
    sphere.material.uniforms.image.value = originalTexture;
    sphere.material.uniforms.showSelection.value = 1;
    status.textContent = t(
      "Editando la selección anterior. Usa Borrar selección para empezar de nuevo.",
    );
  } else
    status.textContent = t(
      "Ajustes modificados. Aplica de nuevo para actualizar la vista previa.",
    );
}
function resize() {
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
  camera.aspect = viewer.clientWidth / viewer.clientHeight;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer);
resize();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const dt = lastFrameTime ? Math.min(50, Math.max(0, now - lastFrameTime)) : 0;
  lastFrameTime = now;
  if (dt && Math.abs(zoomValue - targetZoom) > 0.01) {
    zoomValue += (targetZoom - zoomValue) * (1 - Math.exp(-dt / 45));
    if (Math.abs(zoomValue - targetZoom) < 0.01) zoomValue = targetZoom;
  }
  for (const [id, value] of [
    ["perspective", 65],
    ["wide", 30],
    ["planet", 0],
  ])
    $(id).classList.toggle("active", Math.abs(targetZoom - value) < 0.01);
  if (!drag && mode === "navigate" && dt) {
    const horizontal = integrateVelocity(velocityLon, dt),
      vertical = integrateVelocity(velocityLat, dt);
    lon += horizontal.distance;
    const nextLat = lat + vertical.distance;
    lat = Math.max(-89, Math.min(89, nextLat));
    if (lat !== nextLat) velocityLat = 0;
    velocityLon = horizontal.velocity;
    velocityLat = lat === nextLat ? vertical.velocity : 0;
    if (Math.abs(velocityLon) < 0.0001) velocityLon = 0;
    if (Math.abs(velocityLat) < 0.0001) velocityLat = 0;
  }
  const proj = parameters(zoomValue, lat);
  camera.fov = THREE.MathUtils.radToDeg(proj.fov);
  camera.updateProjectionMatrix();
  if (sphere) {
    const u = sphere.material.uniforms;
    u.lon.value = THREE.MathUtils.degToRad(lon);
    u.lat.value = THREE.MathUtils.degToRad(proj.lat);
    u.aspect.value = camera.aspect;
    u.fov.value = proj.fov;
    u.stereoFov.value = proj.stereoFov;
    u.blend.value = proj.blend;
  }
  renderer.render(scene, screenCamera);
  drawContour();
}
animate();

function point(e) {
  const rect = renderer.domElement.getBoundingClientRect(),
    x = ((e.clientX - rect.left) / rect.width) * 2 - 1,
    y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
  const center = screenDirection(x, y, camera.aspect, lon, lat, zoomValue),
    edge = screenDirection(
      x + Number($("brush").value) / rect.width,
      y,
      camera.aspect,
      lon,
      lat,
      zoomValue,
    ),
    uv = uvFromDirection(center);
  return {
    x: uv[0] * mask.width,
    y: uv[1] * mask.height,
    r: (angularDistance(center, edge) * Math.PI) / 180,
  };
}
function fitView() {
  const tiny = document.createElement("canvas");
  tiny.width = 512;
  tiny.height = 256;
  const context = tiny.getContext("2d");
  context.drawImage(mask, 0, 0, 512, 256);
  const pixels = context.getImageData(0, 0, 512, 256).data,
    points = [];
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      if (pixels[(y * 512 + x) * 4 + 3] <= 32) continue;
      const theta = ((x + 0.5) * 2 * Math.PI) / 512;
      const phi = ((y + 0.5) * Math.PI) / 256;
      points.push([
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ]);
    }
  }
  return fitDirections(points, camera.aspect);
}
// Rasterize the angular brush footprint by latitude; wrap every interval at the seam.
function dab(p, radius) {
  const lat = Math.PI / 2 - (p.y / mask.height) * Math.PI,
    longitude = (p.x / mask.width) * 2 * Math.PI,
    dy = (radius * mask.height) / Math.PI;
  const first = Math.max(0, Math.floor(p.y - dy)),
    last = Math.min(mask.height - 1, Math.ceil(p.y + dy));
  mc.fillStyle = "rgba(255,65,130,1)";
  for (let y = first; y <= last; y++) {
    const rowLat = Math.PI / 2 - ((y + 0.5) / mask.height) * Math.PI,
      den = Math.cos(lat) * Math.cos(rowLat),
      numer = Math.cos(radius) - Math.sin(lat) * Math.sin(rowLat);
    let half;
    if (Math.abs(den) < 1e-12) half = numer <= 0 ? Math.PI : 0;
    else {
      const value = numer / den;
      half = value <= -1 ? Math.PI : value >= 1 ? 0 : Math.acos(value);
    }
    if (!half) continue;
    const center = (longitude / (2 * Math.PI)) * mask.width,
      span = (half / (2 * Math.PI)) * mask.width;
    for (const shift of [-mask.width, 0, mask.width])
      mc.fillRect(center - span + shift, y, span * 2 + 1, 1);
  }
}
function stroke(a, b, radius) {
  if (!a || !b) return;
  const vector = (p) => {
      const lat = Math.PI / 2 - (p.y / mask.height) * Math.PI,
        lon = (p.x / mask.width) * 2 * Math.PI;
      return [
        Math.cos(lat) * Math.cos(lon),
        Math.sin(lat),
        Math.cos(lat) * Math.sin(lon),
      ];
    },
    v = vector(a),
    w = vector(b),
    angle = Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          v.reduce((s, x, i) => s + x * w[i], 0),
        ),
      ),
    ),
    steps = Math.max(1, Math.ceil(angle / Math.max(radius / 3, 0.0001)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      k = angle < 1e-8 ? 0 : Math.sin((1 - t) * angle) / Math.sin(angle),
      l = angle < 1e-8 ? 1 : Math.sin(t * angle) / Math.sin(angle),
      d = v.map((x, j) => x * k + w[j] * l);
    dab(
      {
        x: ((Math.atan2(d[2], d[0]) / (2 * Math.PI) + 1) % 1) * mask.width,
        y: (Math.acos(Math.max(-1, Math.min(1, d[1]))) / Math.PI) * mask.height,
      },
      (a.r || radius) * (1 - t) + (b.r || radius) * t,
    );
  }
  overlay.needsUpdate = true;
}
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!loaded || busy || e.button !== 0) return;
  stopInertia();
  dragDistance = 0;
  lastDirection = { x: 0, y: 0 };
  drag = true;
  renderer.domElement.setPointerCapture(e.pointerId);
  last = { x: e.clientX, y: e.clientY, time: performance.now() };
  if (mode === "navigate") renderer.domElement.style.cursor = "grabbing";
  if (mode === "paint" || mode === "erase") {
    invalidate(true);
    previous = point(e);
    if (previous) {
      snapshot();
      activeStroke = {
        width: previous.r,
        points: [previous],
        erase: mode === "erase",
      };
      strokes.push(activeStroke);
      selected = true;
      mc.globalCompositeOperation = activeStroke.erase
        ? "destination-out"
        : "source-over";
      stroke(previous, previous, activeStroke.width);
      mc.globalCompositeOperation = "source-over";
    }
  }
});
renderer.domElement.addEventListener("pointermove", (e) => {
  brushPoint = { clientX: e.clientX, clientY: e.clientY };
  if (!drag) return;
  if (mode === "navigate") {
    const now = performance.now(),
      dt = Math.max(1, now - last.time),
      dx = -(e.clientX - last.x) * 0.16,
      dy = (e.clientY - last.y) * 0.16;
    lon += dx;
    const nextLat = lat + dy;
    lat = Math.max(-89, Math.min(89, nextLat));
    if (dx || dy) {
      dragDistance += Math.hypot(dx, dy) / 0.16;
      const usableY = lat === nextLat ? dy : 0;
      if (dx || usableY) lastDirection = { x: dx, y: usableY };
      motionSamples.push({
        dx: dx / 0.16,
        dy: (lat === nextLat ? dy : 0) / 0.16,
        dt: Math.min(dt, 80),
        t: now,
      });
      motionSamples = motionSamples.filter((sample) => now - sample.t <= 130);
      const launch = launchVelocity(motionSamples, now);
      velocityLon = launch.x;
      velocityLat = launch.y;
      lastMoveTime = now;
    }
    last = { x: e.clientX, y: e.clientY, time: now };
  } else {
    let p = point(e);
    if (p && activeStroke) {
      activeStroke.points.push(p);
      mc.globalCompositeOperation = activeStroke.erase
        ? "destination-out"
        : "source-over";
      stroke(previous, p, activeStroke.width);
      mc.globalCompositeOperation = "source-over";
    }
    previous = p;
  }
});
function stopDrag(keepInertia = false) {
  if (
    !keepInertia ||
    mode !== "navigate" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    stopInertia();
  else {
    const launch = launchVelocity(motionSamples, performance.now());
    velocityLon = launch.x;
    velocityLat = launch.y;
  }
  drag = false;
  previous = null;
  activeStroke = null;
  if (renderer.domElement)
    renderer.domElement.style.cursor = mode === "paint" ? "crosshair" : "grab";
}
renderer.domElement.addEventListener("pointerleave", () => {
  brushPoint = null;
});
renderer.domElement.addEventListener("pointerup", () => stopDrag(true));
renderer.domElement.addEventListener("pointercancel", () => stopDrag());
renderer.domElement.addEventListener("lostpointercapture", () => {
  if (drag) stopDrag();
});
window.addEventListener("blur", () => stopDrag());
function changeZoom(delta) {
  if (!loaded || !Number.isFinite(delta)) return;
  targetZoom = Math.max(0, Math.min(100, targetZoom - delta));
  $("zoomSlider").value = String(Math.round(targetZoom));
  syncRangeControls();
}
$("stage").addEventListener(
  "wheel",
  (event) => {
    if (!loaded || busy || event.target.closest(".zoom,.presets")) return;
    event.preventDefault();
    changeZoom(
      normalizeWheel(event, renderer.domElement.clientHeight) *
        (event.ctrlKey ? 0.16 : 0.08),
    );
  },
  { passive: false },
);
$("zoomIn").onclick = () => changeZoom(-8);
$("zoomOut").onclick = () => changeZoom(8);
$("zoomSlider").oninput = () => {
  targetZoom = Number($("zoomSlider").value);
};
for (const [id, value] of [
  ["perspective", 65],
  ["wide", 30],
  ["planet", 0],
])
  $(id).onclick = () => {
    targetZoom = value;
    $("zoomSlider").value = String(value);
    syncRangeControls();
  };
function setMode(v) {
  stopDrag();
  mode = v;
  $("navigate").classList.toggle("active", v === "navigate");
  $("paint").classList.toggle("active", v === "paint");
  $("navigate").setAttribute("aria-pressed", String(v === "navigate"));
  $("paint").setAttribute("aria-pressed", String(v === "paint"));
  $("erase").classList.toggle("active", v === "erase");
  $("erase").setAttribute("aria-pressed", String(v === "erase"));
  renderer.domElement.style.cursor =
    v === "paint" || v === "erase" ? "crosshair" : "grab";
  if (sphere && v === "navigate" && !$("export").disabled && previewTexture) {
    sphere.material.uniforms.image.value = previewTexture;
    sphere.material.uniforms.showSelection.value = 0;
  }
  if (sphere && (v === "paint" || v === "erase")) {
    sphere.material.uniforms.image.value = originalTexture;
    sphere.material.uniforms.showSelection.value = 1;
  }
  $("hint").textContent =
    v === "navigate"
      ? t("Arrastra para mirar · pellizca para zoom")
      : t("Pinta sobre la persona · pellizca para zoom");
}
$("navigate").onclick = () => setMode("navigate");
$("paint").onclick = () => {
  if (!loaded || busy) return;
  setMode("paint");
};
$("erase").onclick = () => {
  if (!loaded || busy) return;
  setMode("erase");
};
$("clear").onclick = () => {
  if (!selected || busy) return;
  snapshot();
  strokes = [];
  redrawMask();
  invalidate(true);
  status.textContent = t("Selección borrada. Puedes deshacer esta acción.");
};
for (const id of [
  "brush",
  "blur",
  "offset",
  "feather",
  "sample",
  "centerSmooth",
])
  $(id).oninput = () => {
    $(id + "Value").textContent = $(id).value;
    if (id !== "brush") invalidate();
    else {
      brushPoint = null;
      brushUntil = performance.now() + 900;
    }
  };
function updateMethodControls() {
  $("blurLabel").hidden = $("method").value !== "blur";
  $("offsetLabel").hidden = $("method").value !== "clone";
  $("sampleLabel").hidden = !["stretch", "guided"].includes($("method").value);
  $("centerLabel").hidden = $("method").value !== "guided";
}
$("method").onchange = () => {
  updateMethodControls();
  invalidate();
};
async function confirmDiscard() {
  setBusy(true, "");
  try {
    return await window.editor.confirmDiscard();
  } catch (error) {
    status.textContent = t("Error: ") + t(error.message);
    return false;
  } finally {
    setBusy(false);
  }
}
$("openEmpty").onclick = () => $("open").click();
$("open").onclick = async () => {
  if (busy) return;
  if (loaded) {
    saveMask();
    if (!(await confirmDiscard())) return;
  }
  setOpenFeedback(status, $("emptyStatus"), "");
  setBusy(true, t("Preparando vista previa…"));
  try {
    const data = await window.editor.open(
      Math.min(renderer.capabilities.maxTextureSize, 8192),
    );
    if (!data) {
      setOpenFeedback(status, $("emptyStatus"), "");
      return;
    }
    const texture = await new THREE.TextureLoader().loadAsync(
      "data:image/jpeg;base64," + data.preview,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (sphere) {
      scene.remove(sphere);
      sphere.material.dispose();
      overlay.dispose();
      originalTexture.dispose();
      if (previewTexture) {
        previewTexture.dispose();
        previewTexture = null;
      }
    }
    $("fileName").textContent = data.name;
    imageInfo = { name: data.name, ...data.info };
    showInfo();
    originalTexture = texture;
    mc.clearRect(0, 0, mask.width, mask.height);
    selected = false;
    strokes = [];
    history = [];
    masks = [newMask()];
    activeMask = 0;
    stamps = [];
    stampPreviewImages.clear();
    activeStamp = 0;
    renderMasks();
    stampUI();
    document.body.classList.remove("no-document");
    $("undo").disabled = true;
    overlay = new THREE.CanvasTexture(mask);
    overlay.colorSpace = THREE.SRGBColorSpace;
    const base = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: {
          image: { value: texture },
          selection: { value: overlay },
          showSelection: { value: 1 },
          lon: { value: 0 },
          lat: { value: 0 },
          aspect: { value: 1 },
          fov: { value: 1 },
          stereoFov: { value: 1 },
          blend: { value: 0 },
        },
        vertexShader: `varying vec2 pos; void main(){pos=position.xy;gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader:
          `uniform sampler2D image,selection;uniform float lon,lat,aspect,fov,stereoFov,blend,showSelection;varying vec2 pos;void main(){vec3 f=vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon));vec3 r=vec3(-sin(lon),0.,cos(lon));vec3 up=cross(r,f);vec2 p=vec2(pos.x*aspect,pos.y);float radius=length(p);float theta=mix(atan(radius*tan(fov/2.)),2.*atan(radius*tan(stereoFov/4.)),blend);vec3 d=radius<0.00001?f:f*cos(theta)+(r*p.x+up*p.y)/radius*sin(theta);vec2 uv=vec2(fract(atan(d.z,d.x)/6.28318530718+1.),1.-acos(clamp(d.y,-1.,1.))/3.14159265359);vec4 color=texture2D(image,uv);vec4 mask=texture2D(selection,uv);gl_FragColor=vec4(mix(color.rgb,mask.rgb,mask.a*.55*showSelection),1.);#include <colorspace_fragment>}`
            .replace(";#include", ";\n#include")
            .replace("<colorspace_fragment>}", "<colorspace_fragment>\n}"),
      }),
    );
    sphere = base;
    scene.add(sphere);
    loaded = true;
    $("empty").style.display = "none";
    $("hint").style.display = "block";
    $("close").disabled = false;
    $("apply").disabled = false;
    $("export").disabled = true;
    status.textContent = `${data.name} · ${data.width} × ${data.height}`;
  } catch (e) {
    const message = String(e.message).replace(
      /^Error invoking remote method '[^']+': Error: /,
      "",
    );
    setOpenFeedback(status, $("emptyStatus"), t(message), true);
  } finally {
    setBusy(false);
  }
};
$("apply").onclick = async () => {
  if (busy) return;
  saveMask();
  if (
    !masks.some((m) => m.enabled && m.strokes.length) &&
    !stamps.some((s) => s.enabled)
  ) {
    status.textContent = t("Pinta primero la zona que deseas editar.");
    return;
  }
  try {
    stopDrag();
    setBusy(true, t("Preparando vista previa…"));
    $("apply").disabled = true;
    $("export").disabled = true;
    status.textContent = t("Preparando vista previa…");
    $("processingText").textContent =
      $("method").value === "ai_local"
        ? t("Eliminando con IA local…")
        : t("Preparando vista previa…");
    $("processing").hidden = false;
    saveMask();
    const previousIndex = activeMask;
    const items = [];
    try {
      for (let i = 0; i < masks.length; i++) {
        const m = masks[i];
        if (!m.enabled || !m.strokes.length) continue;
        strokes = m.strokes;
        redrawMask();
        items.push({
          mask: mask.toDataURL("image/png"),
          options: {
            method: m.method,
            ...m.settings,
            view: ["guided", "ai_local"].includes(m.method)
              ? fitView()
              : { lon, lat, fov: camera.fov, aspect: camera.aspect },
          },
        });
      }
    } finally {
      strokes = masks[previousIndex].strokes;
      redrawMask();
    }
    if (!items.length && !stamps.some((s) => s.enabled))
      throw Error("No hay efectos activos.");
    setMode("navigate");
    const result = await window.editor.apply({
      masks: items,
      stamps: stamps.map(({ preview, ...stamp }) => stamp),
    });
    const texture = await new THREE.TextureLoader().loadAsync(
      "data:image/jpeg;base64," + result.image,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    if (previewTexture) previewTexture.dispose();
    previewTexture = texture;
    imageInfo.appliedPreview = `${texture.image.width} × ${texture.image.height}`;
    showInfo();
    sphere.material.uniforms.image.value = texture;
    sphere.material.uniforms.showSelection.value = 0;
    $("export").disabled = false;
    status.textContent =
      $("method").value === "ai_local"
        ? t("Vista previa con IA local aplicada.")
        : result.info
          ? `Vista previa aplicada. ${result.info.lines} líneas detectadas; ${result.info.guided ? "direcciones cercanas utilizadas" : "sin líneas cercanas: relleno horizontal"}.`
          : t(
              "Vista previa aplicada. Mueve la vista para revisar el resultado.",
            );
  } catch (e) {
    status.textContent = t("Error: ") + t(e.message);
  } finally {
    setBusy(false);
    $("apply").disabled = false;
  }
};
$("close").onclick = async () => {
  if (!loaded || busy) return;
  saveMask();
  if (!(await confirmDiscard())) return;
  try {
    await window.editor.close();
    stopDrag();
    scene.remove(sphere);
    sphere.material.dispose();
    originalTexture.dispose();
    overlay.dispose();
    if (previewTexture) previewTexture.dispose();
    previewTexture = null;
    sphere = null;
    mc.clearRect(0, 0, mask.width, mask.height);
    strokes = [];
    history = [];
    selected = false;
    loaded = false;
    masks = [];
    stamps = [];
    stampPreviewImages.clear();
    $("fileName").textContent = "";
    stampUI();
    document.body.classList.add("no-document");
    lon = 0;
    lat = 0;
    camera.fov = 70;
    ((targetFov = 70), (zoomValue = 65), (targetZoom = 65));
    $("zoomSlider").value = String(targetZoom);
    syncRangeControls();
    camera.updateProjectionMatrix();
    $("empty").style.display = "flex";
    setOpenFeedback(status, $("emptyStatus"), "");
    $("hint").style.display = "none";
    $("close").disabled = true;
    $("undo").disabled = true;
    $("apply").disabled = true;
    $("export").disabled = true;
    setMode("navigate");
    status.textContent = t("Abre una fotografía para comenzar.");
  } catch (e) {
    status.textContent = t("Error: ") + t(e.message);
  }
};
$("export").onclick = () => {
  if (loaded && !busy) $("exportDialog").showModal();
};
$("exportQuality").oninput = () => {
  $("exportQualityValue").textContent = $("exportQuality").value;
};
$("cancelExport").onclick = () => $("exportDialog").close();
$("confirmExport").onclick = async () => {
  const quality = Number($("exportQuality").value);
  $("exportDialog").close();
  try {
    stopDrag();
    setMode("navigate");
    setBusy(true, t("Exportando JPEG…"));
    $("apply").disabled = true;
    $("export").disabled = true;
    $("close").disabled = true;
    status.textContent = t("Procesando a resolución original; puede tardar…");
    const saved = await window.editor.export(quality);
    status.textContent = saved
      ? t("Imagen exportada correctamente.")
      : t("Exportación cancelada.");
  } catch (e) {
    status.textContent = t("Error: ") + t(e.message);
  } finally {
    setBusy(false);
    $("apply").disabled = false;
    $("export").disabled = false;
    $("close").disabled = false;
  }
};

window.editor
  .capabilities()
  .then((c) => {
    $("subject").disabled = !c.vision;
    if (!c.vision)
      $("subject").title = t("Requiere macOS 14 y compilar el helper Vision");
  })
  .catch(() => {});
$("subject").onclick = async () => {
  if (!loaded || busy) return;
  try {
    stopDrag();
    const wasPlanet = zoomValue < 30;
    const capturedView = subjectView(lon, lat, zoomValue, camera.aspect);
    lon = capturedView.lon;
    lat = capturedView.lat;
    targetZoom = zoomValue = capturedView.zoom;
    $("zoomSlider").value = String(Math.round(targetZoom));
    syncRangeControls();
    if (wasPlanet)
      status.textContent = t(
        "La selección de sujeto utiliza una vista perspectiva.",
      );
    setBusy(true, t("Seleccionando sujetos con Vision…"));
    const projection = parameters(capturedView.zoom, capturedView.lat);
    const uniforms = sphere.material.uniforms;
    uniforms.lon.value = THREE.MathUtils.degToRad(capturedView.lon);
    uniforms.lat.value = THREE.MathUtils.degToRad(capturedView.lat);
    uniforms.aspect.value = capturedView.aspect;
    uniforms.fov.value = projection.fov;
    uniforms.blend.value = projection.blend;
    uniforms.stereoFov.value = projection.stereoFov;
    camera.fov = capturedView.fov;
    const visible = uniforms.showSelection.value;
    uniforms.showSelection.value = 0;
    let view;
    try {
      renderer.render(scene, screenCamera);
      view = renderer.domElement.toDataURL("image/png");
    } finally {
      uniforms.showSelection.value = visible;
    }
    const result = await window.editor.selectSubject(view);
    if (!result) {
      status.textContent = t("No se han detectado sujetos de primer plano.");
      return;
    }
    const worker = new Worker("./lib/subject-worker.js");
    const message = await new Promise((resolve, reject) => {
      worker.onmessage = (e) => resolve(e.data);
      worker.onerror = reject;
      worker.postMessage({
        mask: result,
        ...capturedView,
      });
    });
    worker.terminate();
    if (message.error) throw Error(message.error);
    if (!message.count) {
      status.textContent = t("No se han detectado sujetos de primer plano.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = message.width;
    canvas.height = message.height;
    canvas
      .getContext("2d")
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(message.buffer),
          message.width,
          message.height,
        ),
        0,
        0,
      );
    snapshot();
    strokes.push({ kind: "subject", image: canvas });
    redrawMask();
    invalidate(true);
    status.textContent = t("Selección de primer plano lista para revisar.");
  } catch (e) {
    status.textContent = t("Error: ") + t(e.message);
  } finally {
    setBusy(false);
  }
};

$("addStamp").onclick = () => {
  snapshot();
  stamps.push({
    id: crypto.randomUUID(),
    asset: null,
    preview: null,
    lon: 0,
    lat: -90,
    size: 24,
    rotation: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    circle: true,
    enabled: true,
    color: "#ffffff",
  });
  activeStamp = stamps.length - 1;
  stampUI();
  invalidate();
};
$("removeStamp").onclick = () => {
  snapshot();
  stamps.splice(activeStamp, 1);
  activeStamp = Math.max(0, Math.min(activeStamp, stamps.length - 1));
  stampUI();
  invalidate();
};
$("importStamp").onclick = async () => {
  if (!selectedStamp() || busy) return;
  try {
    const result = await window.editor.importStamp();
    if (result) {
      snapshot();
      selectedStamp().asset = result.token;
      selectedStamp().preview = result.preview;
      stampUI();
      invalidate();
    }
  } catch (e) {
    status.textContent = t("Error: ") + t(e.message);
  }
};
for (const [id, key] of [
  ["stampSize", "size"],
  ["stampRotation", "rotation"],
  ["stampScale", "scale"],
  ["stampX", "offsetX"],
  ["stampY", "offsetY"],
])
  $(id).oninput = () => {
    selectedStamp()[key] = Number($(id).value);
    $(id + "Value").textContent = $(id).value;
    drawStampPreview();
    invalidate();
  };
for (const [id, key] of [
  ["stampCircle", "circle"],
  ["stampEnabled", "enabled"],
])
  $(id).onchange = () => {
    snapshot();
    selectedStamp()[key] = $(id).checked;
    drawStampPreview();
    invalidate();
  };
for (const [id, value] of [
  ["stampTop", 90],
  ["stampBottom", -90],
])
  $(id).onclick = () => {
    snapshot();
    selectedStamp().lon = lon;
    selectedStamp().lat = value;
    invalidate();
  };
$("stampHere").onclick = () => {
  snapshot();
  const d = screenDirection(0, 0, camera.aspect, lon, lat, zoomValue);
  selectedStamp().lon = (Math.atan2(d[2], d[0]) * 180) / Math.PI;
  selectedStamp().lat = (Math.asin(d[1]) * 180) / Math.PI;
  invalidate();
};
$("stampCenter").onclick = () => {
  snapshot();
  selectedStamp().offsetX = selectedStamp().offsetY = 0;
  selectedStamp().scale = 1;
  stampUI();
  invalidate();
};
stampUI();

for (const id of [
  "stampSize",
  "stampRotation",
  "stampScale",
  "stampX",
  "stampY",
]) {
  $(id).addEventListener("pointerdown", snapshot);
  $(id).addEventListener("keydown", (e) => {
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ].includes(e.key)
    )
      snapshot();
  });
}

$("stampColor").addEventListener("pointerdown", snapshot);
$("stampColor").oninput = () => {
  selectedStamp().color = $("stampColor").value;
  $("stampHex").value = $("stampColor").value.toUpperCase();
  drawStampPreview();
  invalidate();
};

for (const range of document.querySelectorAll('input[type="range"]')) {
  const label =
    range.dataset.label ||
    range.getAttribute("aria-label") ||
    range.closest("label")?.querySelector("span")?.textContent.trim() ||
    (range.id === "exportQuality" ? "Calidad JPEG" : "Zoom");
  rangeControls.set(
    range.id,
    bindRange(range, {
      label,
      beforeChange: () => {
        if (range.id.startsWith("stamp")) snapshot();
      },
    }),
  );
}
syncRangeControls();
$("stampHex").addEventListener("change", () => {
  const field = $("stampHex"),
    value = field.value.trim();
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    field.value = $("stampColor").value.toUpperCase();
    return;
  }
  if (value.toLowerCase() !== $("stampColor").value.toLowerCase()) {
    snapshot();
    $("stampColor").value = value;
    $("stampColor").dispatchEvent(new Event("input", { bubbles: true }));
  }
  field.value = $("stampColor").value.toUpperCase();
});
$("stampHex").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.blur();
  }
});
$("addMask").addEventListener("click", (event) => event.stopPropagation());

updateMethodControls();
