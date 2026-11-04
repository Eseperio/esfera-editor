const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const sharp = require("sharp");
const { localizeError } = require("./lib/errors.cjs");
const exifr = require("exifr");
const fs = require("fs/promises"),
  os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const runFile = promisify(execFile);
const { createModelManager } = require("./lib/model-manager.cjs");
const runtimeRoot = app.isPackaged
  ? path.join(process.resourcesPath, "runtime")
  : __dirname;
const nativeFile = (name) => path.join(runtimeRoot, "native", name);
function runProcessing(name, specification) {
  const command = app.isPackaged
    ? path.join(runtimeRoot, "python/esfera-process/esfera-process")
    : path.join(__dirname, ".venv/bin/python");
  const args = app.isPackaged
    ? [name, JSON.stringify(specification)]
    : [path.join(__dirname, name + ".py"), JSON.stringify(specification)];
  return runFile(command, args, { maxBuffer: 1024 * 1024 });
}
let modelManager;
function models() {
  return (modelManager ||= createModelManager({
    root: path.join(app.getPath("userData"), "models/lama-v1"),
    legacy: app.isPackaged
      ? null
      : path.join(__dirname, "models/LaMa.mlmodelc"),
    supported: process.platform === "darwin",
    compile: (source, target, signal) =>
      runFile(nativeFile("lama-runner"), ["--compile", source, target], {
        signal,
      }),
    verify: (model, signal) =>
      runFile(nativeFile("lama-runner"), ["--check", model], { signal }),
  }));
}
app.setName?.("Esfera");
let appLanguage = "en";
const translate = (es, en) => (appLanguage === "es" ? es : en);
let current = null,
  win,
  applied = null,
  working = false,
  stampAssets = new Map();
function exclusive(channel, handler) {
  ipcMain.handle(channel, async (...args) => {
    if (working)
      throw Error(
        localizeError("Another operation is already in progress.", appLanguage),
      );
    working = true;
    try {
      return await handler(...args);
    } catch (error) {
      throw Error(localizeError(error.message, appLanguage));
    } finally {
      working = false;
    }
  });
}
function discardDialogOptions() {
  return {
    type: "question",
    buttons: [translate("Cancelar", "Cancel"), translate("Cerrar", "Close")],
    defaultId: 0,
    cancelId: 0,
    message: translate(
      "Se cerrará la imagen y se perderán los cambios no exportados. ¿Quieres continuar?",
      "The image will close and unsaved changes will be lost. Continue?",
    ),
  };
}
app.whenReady().then(() => {
  app.dock?.setIcon(path.join(__dirname, "assets/icon.png"));
  win = new BrowserWindow({
    icon: path.join(__dirname, "assets/icon.png"),
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.on("close", (event) => {
    if (working) {
      event.preventDefault();
      return;
    }
    if (!current) return;
    const choice = dialog.showMessageBoxSync(win, discardDialogOptions());
    if (choice !== 1) event.preventDefault();
  });
  win.loadFile(path.join(__dirname, "index.html"));
});
app.on("window-all-closed", () => app.quit());
exclusive("confirm-discard", async () => {
  if (!current) return false;
  const { response } = await dialog.showMessageBox(win, discardDialogOptions());
  return response === 1;
});
exclusive("close-image", () => {
  current = null;
  applied = null;
  stampAssets.clear();
  return true;
});
exclusive("open", async (_e, maxWidth = 4096) => {
  const r = await dialog.showOpenDialog({
    title: translate("Abrir panorama", "Open panorama"),
    buttonLabel: translate("Abrir", "Open"),
    properties: ["openFile"],
    filters: [
      {
        name: translate("Panorama exportado", "Exported panorama"),
        extensions: ["jpg", "jpeg", "png", "webp"],
      },
    ],
  });
  if (r.canceled) return null;
  const file = r.filePaths[0],
    meta = await sharp(file, { limitInputPixels: 75000000 }).metadata();
  const swap = [5, 6, 7, 8].includes(meta.orientation);
  const width = swap ? meta.height : meta.width,
    height = swap ? meta.width : meta.height;
  if (!width || !height || Math.abs(width / height - 2) > 0.02)
    throw Error(
      "La imagen debe ser un panorama equirectangular 2:1 de hasta 75 megapíxeles.",
    );
  const textureWidth = Math.max(
    1024,
    Math.min(8192, Number.isFinite(maxWidth) ? Math.floor(maxWidth) : 4096),
  );
  let preview;
  try {
    preview = await sharp(file)
      .rotate()
      .resize({ width: textureWidth, withoutEnlargement: true })
      .jpeg({ quality: 94 })
      .toBuffer();
  } catch {
    preview = await sharp(file)
      .rotate()
      .resize({ width: 4096, withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();
  }
  const previewMeta = await sharp(preview).metadata();
  current = { file, width, height };
  applied = null;
  stampAssets.clear();
  let tags = {};
  try {
    tags =
      (await exifr.parse(file, {
        exif: true,
        xmp: true,
        iptc: true,
        icc: true,
        gps: true,
      })) || {};
  } catch {}
  const stat = await fs.stat(file);
  const blocks = Object.fromEntries(
    ["exif", "xmp", "icc", "iptc"]
      .filter((k) => meta[k])
      .map((k) => [k, meta[k].length]),
  );
  return {
    preview: preview.toString("base64"),
    width,
    height,
    name: path.basename(file),
    info: {
      format: meta.format,
      bytes: stat.size,
      width,
      height,
      orientation: meta.orientation,
      space: meta.space,
      previewWidth: previewMeta.width,
      blocks,
      tags: Object.fromEntries(
        Object.entries(tags).map(([key, value]) => {
          if (ArrayBuffer.isView(value))
            return [key, `binary (${value.byteLength} bytes)`];
          if (value instanceof ArrayBuffer)
            return [key, `binary (${value.byteLength} bytes)`];
          if (value instanceof Date) return [key, value.toISOString()];
          if (value && typeof value === "object" && !Array.isArray(value))
            return [key, JSON.stringify(value).slice(0, 1000)];
          return [key, value];
        }),
      ),
    },
  };
});
function settings(input) {
  return {
    method: ["clone", "stretch", "blur", "guided", "ai_local"].includes(
      input.method,
    )
      ? input.method
      : "blur",
    blur: Math.max(1, Math.min(100, Number(input.blur) || 30)),
    feather: Math.max(0, Math.min(50, Number(input.feather) || 0)),
    offset: Math.max(-40, Math.min(40, Number(input.offset) || 0)),
    sample: Math.max(1, Math.min(100, Number(input.sample) || 10)),
    centerSmooth: Math.max(0, Math.min(30, Number(input.centerSmooth) || 0)),
    view: input.view,
  };
}
async function processImage(maskData, opts, preview) {
  const options = settings(opts);
  if (["guided", "ai_local"].includes(options.method))
    return guidedImage(maskData, options, preview);
  const scale = preview ? Math.min(1, 4096 / current.width) : 1;
  const image = await sharp(current.file, { limitInputPixels: 75000000 })
    .rotate()
    .resize({
      width: Math.round(current.width * scale),
      height: Math.round(current.height * scale),
      fit: "fill",
    })
    .removeAlpha()
    .png()
    .toBuffer();
  const m = await sharp(image).metadata(),
    w = m.width,
    h = m.height;
  const maskInput = Buffer.from(maskData.split(",")[1], "base64");
  const hardMask = await sharp(maskInput)
    .resize(w, h)
    .extractChannel("alpha")
    .raw()
    .toBuffer();
  let mask = sharp(maskInput).resize(w, h).extractChannel("alpha");
  if (options.feather) mask = mask.blur(Math.max(0.3, options.feather * scale));
  const alpha = await mask.png().toBuffer();
  let replacement;
  if (options.method === "blur") {
    replacement = await sharp(image)
      .blur(Math.max(0.3, options.blur * scale))
      .toBuffer();
  } else if (options.method === "stretch") {
    replacement = await stretchRows(
      image,
      hardMask,
      w,
      h,
      Math.max(1, Math.round(options.sample * scale)),
    );
  } else {
    const shift = ((Math.round((w * options.offset) / 100) % w) + w) % w;
    if (!shift)
      throw Error(
        "Elige un desplazamiento distinto de cero para copiar el fondo.",
      );
    const left = await sharp(image)
      .extract({ left: shift, top: 0, width: w - shift, height: h })
      .png()
      .toBuffer();
    const right = await sharp(image)
      .extract({ left: 0, top: 0, width: shift, height: h })
      .png()
      .toBuffer();
    replacement = await sharp({
      create: { width: w, height: h, channels: 3, background: "#000" },
    })
      .composite([
        { input: left, left: 0, top: 0 },
        { input: right, left: w - shift, top: 0 },
      ])
      .png()
      .toBuffer();
  }
  replacement = await sharp(replacement).removeAlpha().png().toBuffer();
  const layer = await sharp(replacement).joinChannel(alpha).png().toBuffer();
  return sharp(image)
    .composite([{ input: layer }])
    .png({ compressionLevel: 3 })
    .toBuffer();
}
async function guidedImage(maskData, options, preview) {
  const model =
    options.method === "ai_local" ? (await models().status()).model : null;
  if (options.method === "ai_local" && !model)
    throw Error("Install the local AI model from the Local AI button first.");
  if (
    !options.view ||
    !["lon", "lat", "fov", "aspect"].every((k) =>
      Number.isFinite(options.view[k]),
    )
  )
    throw Error("No se ha podido obtener la vista actual.");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "esfera-guided-"));
  try {
    const maskFile = path.join(dir, "mask.png"),
      output = path.join(dir, "output.png");
    await fs.writeFile(maskFile, Buffer.from(maskData.split(",")[1], "base64"));
    const spec = {
      image: current.file,
      mask: maskFile,
      output,
      preview,
      method: options.method,
      runner: nativeFile("lama-runner"),
      model,
      width: current.width,
      sample: options.sample,
      feather: options.feather,
      centerSmooth: options.centerSmooth,
      ...options.view,
    };
    const child = await runProcessing("guided", spec);
    const info = JSON.parse(child.stdout.trim());
    const result = await fs.readFile(output);
    return { image: result, info, overlay: true };
  } catch (e) {
    const message = e.stderr?.trim().split("\n").pop() || e.message;
    throw Error(message.replace(/^ValueError: /, ""));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
// Fill each selected horizontal run from samples immediately outside its edges.
// Treat the panorama as circular so runs crossing the 0/360 seam remain contiguous.
async function stretchRows(image, mask, w, h, sample) {
  const source = await sharp(image).removeAlpha().raw().toBuffer();
  const output = Buffer.from(source);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let start = 0;
    while (start < w && mask[row + start] > 16) start++;
    if (start === w) continue;
    let n = 1;
    while (n <= w) {
      let x = (start + n) % w;
      if (mask[row + x] <= 16) {
        n++;
        continue;
      }
      let begin = n;
      while (n <= w && mask[row + ((start + n) % w)] > 16) n++;
      const len = n - begin;
      let sumL = [0, 0, 0],
        sumR = [0, 0, 0],
        countL = 0,
        countR = 0;
      for (let i = 1; i <= sample; i++) {
        let l = (start + begin - i + w * 2) % w,
          r = (start + begin + len - 1 + i) % w;
        if (mask[row + l] <= 16) {
          for (let c = 0; c < 3; c++) sumL[c] += source[(row + l) * 3 + c];
          countL++;
        }
        if (mask[row + r] <= 16) {
          for (let c = 0; c < 3; c++) sumR[c] += source[(row + r) * 3 + c];
          countR++;
        }
      }
      if (!countL || !countR) continue;
      for (let k = 0; k < len; k++) {
        let idx = (row + ((start + begin + k) % w)) * 3,
          t = (k + 1) / (len + 1);
        for (let c = 0; c < 3; c++)
          output[idx + c] = Math.round(
            (sumL[c] / countL) * (1 - t) + (sumR[c] / countR) * t,
          );
      }
    }
  }
  return sharp(output, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}
async function processMasks(items, preview, stamps = []) {
  const original = current.file,
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "esfera-layers-"));
  const normalized = path.join(dir, "normalized.png");
  let source = normalized;
  try {
    let base = sharp(original, { limitInputPixels: 75000000 }).rotate();
    if (preview) base = base.resize({ width: 4096, withoutEnlargement: true });
    await base.keepMetadata().withIccProfile("srgb").png().toFile(normalized);
    for (let i = 0; i < items.length; i++) {
      current.file = source;
      const output = await processImage(
        items[i].mask,
        items[i].options,
        preview,
      );
      let image = output.image || output;
      if (output.overlay) {
        const scale = preview ? Math.min(1, 4096 / current.width) : 1;
        image = await sharp(source, { limitInputPixels: 75000000 })
          .rotate()
          .resize({
            width: Math.round(current.width * scale),
            height: Math.round(current.height * scale),
            fit: "fill",
          })
          .composite([{ input: image }])
          .png()
          .toBuffer();
      }
      source = path.join(dir, `layer-${i}.png`);
      await fs.writeFile(source, image);
    }
    if (stamps.length) {
      const output = path.join(dir, "stamped.png"),
        resolved = [];
      for (let i = 0; i < stamps.length; i++) {
        const { assetBuffer, ...stamp } = stamps[i];
        if (assetBuffer) {
          stamp.path = path.join(dir, `asset-${i}.png`);
          await fs.writeFile(stamp.path, assetBuffer);
        }
        resolved.push(stamp);
      }
      await runProcessing("stamps", {
        image: source,
        output,
        stamps: resolved,
      });
      source = output;
    }
    const finalPixels = await fs.readFile(source);
    return await sharp(normalized)
      .composite([{ input: finalPixels }])
      .keepMetadata()
      .withIccProfile("srgb")
      .png()
      .toBuffer();
  } finally {
    current.file = original;
    await fs.rm(dir, { recursive: true, force: true });
  }
}
function validateMasks(items) {
  if (!Array.isArray(items) || items.length > 32)
    throw Error("Select at least one mask (maximum 32).");
  return items.map((item) => {
    if (
      typeof item.mask !== "string" ||
      !item.mask.startsWith("data:image/png;base64,") ||
      item.mask.length > 40_000_000
    )
      throw Error("Invalid mask.");
    return { mask: item.mask, options: settings(item.options || {}) };
  });
}
exclusive("apply", async (_e, document) => {
  if (!current) throw Error("Open an image first.");
  const snapshot = validateMasks(document.masks);
  const stamps = validateStamps(document.stamps);
  if (!snapshot.length && !stamps.length)
    throw Error("Add a selection or stamp first.");
  const output = await processMasks(snapshot, true, stamps);
  const image = await sharp(output)
    .resize({ width: 4096, withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
  applied = { masks: snapshot, stamps };
  return { image: image.toString("base64") };
});
exclusive("export", async (_e, quality) => {
  if (!current || !applied) throw Error("Apply the preview first.");
  if (!Number.isInteger(quality) || quality < 1 || quality > 100)
    throw Error("JPEG quality must be between 1 and 100.");
  const r = await dialog.showSaveDialog({
    title: translate("Exportar JPEG", "Export JPEG"),
    buttonLabel: translate("Guardar", "Save"),
    defaultPath: translate("panorama-editado.jpg", "panorama-edited.jpg"),
    filters: [{ name: "JPEG", extensions: ["jpg", "jpeg"] }],
  });
  if (r.canceled) return false;
  let target = r.filePath;
  const suffix = path.extname(target).toLowerCase();
  if (!suffix) target += ".jpg";
  else if (![".jpg", ".jpeg"].includes(suffix))
    throw Error("Choose a JPEG file.");
  if (path.resolve(target) === path.resolve(current.file))
    throw Error("Choose a file different from the original.");
  const output = await processMasks(applied.masks, false, applied.stamps);
  const pipeline = sharp(output).keepMetadata().withIccProfile("srgb");
  await pipeline
    .jpeg({ quality, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(target);
  return true;
});

ipcMain.handle("capabilities", async () => {
  let vision = false;
  try {
    await fs.access(nativeFile("subject-mask"));
    vision =
      process.platform === "darwin" && Number(os.release().split(".")[0]) >= 23;
  } catch {}
  let installer = false;
  try {
    await fs.access(nativeFile("lama-runner"));
    installer = process.platform === "darwin";
  } catch {}
  const status = await models().status();
  return { vision, lama: status.ready, lamaInstaller: installer };
});
ipcMain.handle("model-status", () => models().status());
ipcMain.handle("cancel-model-install", () => {
  models().cancel();
});
exclusive("install-model", async () => {
  try {
    return await models().install((progress) => {
      if (win && !win.isDestroyed())
        win.webContents.send("model-progress", progress);
    });
  } catch (error) {
    if (error.name === "AbortError")
      throw Error("Model installation cancelled.");
    throw error;
  }
});
exclusive("select-subject", async (_e, data) => {
  if (!current) throw Error("Open an image first.");
  if (
    typeof data !== "string" ||
    !data.startsWith("data:image/png;base64,") ||
    data.length > 30_000_000
  )
    throw Error("Invalid view.");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "esfera-vision-"));
  try {
    const input = path.join(dir, "view.png"),
      output = path.join(dir, "mask.png");
    await fs.writeFile(
      input,
      Buffer.from(data.slice(data.indexOf(",") + 1), "base64"),
    );
    const result = await runFile(nativeFile("subject-mask"), [input, output], {
      maxBuffer: 1024 * 1024,
    });
    if (result.stdout.trim() === "no_subject") return null;
    return (
      "data:image/png;base64," + (await fs.readFile(output)).toString("base64")
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

function validateStamps(input) {
  if (!Array.isArray(input) || input.length > 32)
    throw Error("Invalid stamps.");
  return input
    .filter((s) => s.enabled)
    .map((s) => {
      for (const [key, min, max] of [
        ["lon", -3600, 3600],
        ["lat", -90, 90],
        ["size", 2, 120],
        ["rotation", 0, 360],
        ["scale", 0.1, 5],
        ["offsetX", -2, 2],
        ["offsetY", -2, 2],
      ])
        if (
          typeof s[key] !== "number" ||
          !Number.isFinite(s[key]) ||
          s[key] < min ||
          s[key] > max
        )
          throw Error("Invalid stamp setting.");
      const assetBuffer = s.asset ? stampAssets.get(s.asset) : null;
      if (s.asset && !assetBuffer) throw Error("Unknown stamp image.");
      const hex = /^#[0-9a-f]{6}$/i.test(s.color || "") ? s.color : "#ffffff";
      return {
        ...s,
        assetBuffer,
        color: [
          parseInt(hex.slice(5, 7), 16),
          parseInt(hex.slice(3, 5), 16),
          parseInt(hex.slice(1, 3), 16),
        ],
        circle: !!s.circle,
      };
    });
}
exclusive("import-stamp", async () => {
  if (!current) throw Error("Open an image first.");
  const selection = await dialog.showOpenDialog({
    title: translate("Importar imagen de sello", "Import stamp image"),
    buttonLabel: translate("Importar", "Import"),
    properties: ["openFile"],
    filters: [
      {
        name: translate("Imagen", "Image"),
        extensions: ["png", "jpg", "jpeg", "webp"],
      },
    ],
  });
  if (selection.canceled) return null;
  const file = selection.filePaths[0];
  const preview = await sharp(file, { limitInputPixels: 16000000 })
    .resize({
      width: 256,
      height: 256,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  const data = await sharp(file, { limitInputPixels: 16000000 })
    .rotate()
    .png()
    .toBuffer();
  if (data.length > 64000000) throw Error("Stamp image is too large.");
  const token = require("crypto").randomUUID();
  stampAssets.set(token, data);
  return { token, preview: preview.toString("base64") };
});

module.exports = { processMasks };

ipcMain.handle("set-language", (_event, language) => {
  appLanguage = language === "es" ? "es" : "en";
  return appLanguage;
});
