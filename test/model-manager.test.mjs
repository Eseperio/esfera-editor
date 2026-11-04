import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const { createModelManager, downloadFile } = createRequire(import.meta.url)(
  "../lib/model-manager.cjs",
);
const bytes = Buffer.from("test model weights");
const file = {
  path: "weights.bin",
  url: "https://example.test/model",
  sha256: createHash("sha256").update(bytes).digest("hex"),
  maxBytes: 100,
};
async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "esfera-model-test-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("verified installation publishes atomically, survives restart and skips subsequent downloads", () =>
  fixture(async (root) => {
    let downloads = 0,
      compilations = 0;
    const settings = {
      root,
      files: [file],
      download: async (_file, output) => {
        downloads++;
        await writeFile(output, bytes);
      },
      compile: async (_pkg, output) => {
        compilations++;
        await mkdir(output);
        await writeFile(path.join(output, "coremldata.bin"), bytes);
      },
      verify: async () => {},
    };
    const manager = createModelManager(settings);
    assert.equal((await manager.status()).ready, false);
    const first = manager.install();
    assert.equal(manager.install(), first);
    assert.equal((await first).ready, true);
    const restarted = createModelManager(settings);
    assert.equal((await restarted.status()).ready, true);
    assert.equal((await restarted.install()).installing, false);
    assert.equal(downloads, 1);
    assert.equal(compilations, 1);
    assert.deepEqual(await readdir(root), ["LaMa.mlmodelc"]);
  }));
test("compilation failures and cancellation leave no installed or partial model and allow retry", () =>
  fixture(async (root) => {
    let cancel = false;
    const manager = createModelManager({
      root,
      files: [file],
      download: async (_file, output, { signal }) => {
        await writeFile(output, bytes);
        if (cancel) {
          manager.cancel();
          signal.throwIfAborted();
        }
      },
      compile: async () => {
        throw Error("compile failure");
      },
      verify: async () => {},
    });
    await assert.rejects(manager.install(), /compile failure/);
    assert.equal((await manager.status()).ready, false);
    assert.deepEqual(await readdir(root), []);
    cancel = true;
    await assert.rejects(manager.install(), { name: "AbortError" });
    assert.deepEqual(await readdir(root), []);
  }));
test("download verifies SHA-256, bounds size and rejects failed HTTP responses", () =>
  fixture(async (root) => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        const response = new Response(bytes);
        Object.defineProperty(response, "url", { value: file.url });
        return response;
      };
      const options = { signal: new AbortController().signal, progress() {} };
      await downloadFile(file, path.join(root, "good"), options);
      await assert.rejects(
        downloadFile(
          { ...file, sha256: "0".repeat(64) },
          path.join(root, "bad"),
          options,
        ),
        /checksum/,
      );
      await assert.rejects(
        downloadFile(
          { ...file, maxBytes: 2 },
          path.join(root, "large"),
          options,
        ),
        /size limit/,
      );
      globalThis.fetch = async () => new Response("not found", { status: 404 });
      await assert.rejects(
        downloadFile(file, path.join(root, "missing"), options),
        /download failed/,
      );
    } finally {
      globalThis.fetch = original;
    }
  }));
