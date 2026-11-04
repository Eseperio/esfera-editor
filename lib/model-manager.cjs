const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { createWriteStream } = require("node:fs");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const manifest = require("../models/lama-manifest.json");

async function isModel(directory) {
  try {
    return (await fs.stat(path.join(directory, "coremldata.bin"))).isFile();
  } catch {
    return false;
  }
}
async function downloadFile(file, destination, { signal, progress }) {
  const response = await fetch(file.url, { signal });
  if (!response.ok || !response.body || !response.url.startsWith("https:"))
    throw Error("Model download failed. Check your connection and try again.");
  const hash = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, done) {
      bytes += chunk.length;
      if (bytes > file.maxBytes)
        return done(Error("Model download exceeded its size limit."));
      hash.update(chunk);
      progress(bytes, Number(response.headers.get("content-length")) || null);
      done(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body),
    meter,
    createWriteStream(destination, { flags: "wx" }),
    { signal },
  );
  if (hash.digest("hex") !== file.sha256)
    throw Error("Model checksum mismatch. Please retry the installation.");
}
function createModelManager({
  root,
  legacy,
  supported = true,
  compile,
  verify,
  files = manifest.files,
  download = downloadFile,
}) {
  const target = path.join(root, "LaMa.mlmodelc");
  let pending = null,
    controller = null;
  async function status() {
    const model = (await isModel(target))
      ? target
      : legacy && (await isModel(legacy))
        ? legacy
        : null;
    return {
      ready: !!model && supported,
      supported,
      model,
      installing: !!pending,
    };
  }
  function install(progress = () => {}) {
    if (pending) return pending;
    controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(15 * 60 * 1000),
    ]);
    pending = (async () => {
      if (!supported)
        throw Error(
          "Local AI installation is currently available on macOS only.",
        );
      const initial = await status();
      if (initial.ready) return { ...initial, installing: false };
      await fs.mkdir(root, { recursive: true });
      const staging = await fs.mkdtemp(path.join(root, ".install-"));
      let downloaded = 0;
      try {
        const pkg = path.join(staging, "LaMa.mlpackage");
        for (const file of files) {
          // Manifest paths are fixed application resources, never renderer input.
          if (path.isAbsolute(file.path) || file.path.split("/").includes(".."))
            throw Error("Invalid model manifest.");
          const destination = path.join(pkg, file.path);
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await download(file, destination, {
            signal,
            progress(bytes, total) {
              progress({
                phase: "download",
                bytes: downloaded + bytes,
                fileBytes: bytes,
                fileTotal: total,
              });
            },
          });
          downloaded += (await fs.stat(destination)).size;
        }
        signal.throwIfAborted();
        progress({ phase: "compile", bytes: downloaded });
        const compiled = path.join(staging, "LaMa.mlmodelc");
        await compile(pkg, compiled, signal);
        signal.throwIfAborted();
        await verify(compiled, signal);
        if (!(await isModel(compiled)))
          throw Error("The compiled model is incomplete.");
        // Never publish a partial download or overwrite a working model.
        const previous = path.join(root, `.previous-${randomUUID()}`);
        let moved = false;
        try {
          await fs.rename(target, previous);
          moved = true;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        try {
          await fs.rename(compiled, target);
        } catch (error) {
          if (moved) await fs.rename(previous, target);
          throw error;
        }
        if (moved) await fs.rm(previous, { recursive: true, force: true });
        progress({ phase: "ready", bytes: downloaded });
        return {
          ready: true,
          supported: true,
          model: target,
          installing: false,
        };
      } finally {
        await fs.rm(staging, { recursive: true, force: true });
      }
    })().finally(() => {
      pending = null;
      controller = null;
    });
    return pending;
  }
  return { status, install, cancel: () => controller?.abort() };
}
module.exports = { createModelManager, downloadFile };
