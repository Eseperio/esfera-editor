import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
const require = createRequire(import.meta.url);
test("two masks process in order and export at original dimensions with metadata", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "esfera-pipeline-"));
  let input = path.join(dir, "input.jpg"),
    output = path.join(dir, "output.jpg");
  try {
    const w = 512,
      h = 256,
      pixels = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 3;
        pixels[i] = x % 256;
        pixels[i + 1] = y % 256;
        pixels[i + 2] = ((x >> 4) & 1) * 220;
      }
    await sharp(pixels, { raw: { width: w, height: h, channels: 3 } })
      .withIccProfile("srgb")
      .withExif({ IFD0: { Make: "Esfera synthetic" } })
      .withXmp(
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>',
      )
      .jpeg({ quality: 95 })
      .toFile(input);
    const handlers = new Map(),
      electron = {
        app: { whenReady: () => ({ then() {} }), on() {} },
        BrowserWindow: class {},
        ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
        dialog: {
          showOpenDialog: async () => ({ canceled: false, filePaths: [input] }),
          showSaveDialog: async () => ({ canceled: false, filePath: output }),
        },
      };
    const Module = require("node:module"),
      original = Module._load;
    Module._load = function (request, ...args) {
      return request === "electron"
        ? electron
        : original.call(this, request, ...args);
    };
    let main;
    try {
      main = require("../main.js");
    } finally {
      Module._load = original;
    }
    await handlers.get("set-language")(null, "es");
    await assert.rejects(
      handlers.get("apply")(null, { masks: [], stamps: [] }),
      /Abre primero una imagen/,
    );
    await handlers.get("open")();
    await assert.rejects(
      handlers.get("apply")(null, { masks: [], stamps: [] }),
      /Añade primero una selección o un sello/,
    );
    await handlers.get("set-language")(null, "en");
    async function mask(left) {
      return (
        "data:image/png;base64," +
        (
          await sharp({
            create: {
              width: w,
              height: h,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
          })
            .composite([
              {
                input: await sharp({
                  create: {
                    width: 48,
                    height: 48,
                    channels: 4,
                    background: { r: 255, g: 0, b: 0, alpha: 1 },
                  },
                })
                  .png()
                  .toBuffer(),
                left,
                top: 80,
              },
            ])
            .png()
            .toBuffer()
        ).toString("base64")
      );
    }
    const stamps = existsSync(".venv/bin/python")
      ? [
          {
            lon: 90,
            lat: 0,
            size: 20,
            rotation: 0,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            circle: true,
            enabled: true,
            asset: null,
          },
        ]
      : [];
    await handlers.get("apply")(null, {
      masks: [
        {
          mask: await mask(50),
          options: { method: "blur", blur: 8, feather: 0 },
        },
        {
          mask: await mask(300),
          options: { method: "clone", offset: 10, feather: 0 },
        },
      ],
      stamps,
    });
    assert.equal(await handlers.get("export")(null, 92), true);
    const meta = await sharp(output).metadata();
    assert.equal(meta.width, w);
    assert.equal(meta.height, h);
    assert.ok(meta.exif);
    assert.ok(meta.xmp);
    assert.ok(meta.icc);
    const tags = await require("exifr").parse(output);
    assert.equal(tags.Make, "Esfera synthetic");
    const source = await sharp(input).raw().toBuffer(),
      result = await sharp(output).raw().toBuffer();
    let difference = (x, y) => {
      let i = (y * w + x) * 3;
      return (
        Math.abs(source[i] - result[i]) +
        Math.abs(source[i + 1] - result[i + 1]) +
        Math.abs(source[i + 2] - result[i + 2])
      );
    };
    assert.ok(difference(65, 100) > 4);
    assert.ok(difference(315, 100) > 4);
    assert.ok(difference(200, 200) < 15);
    if (stamps.length) assert.ok(difference(128, 128) > 60);
    input = path.join(dir, "rotated.jpg");
    output = path.join(dir, "rotated-out.jpg");
    await sharp({
      create: { width: 256, height: 512, channels: 3, background: "#7290b0" },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toFile(input);
    const opened = await handlers.get("open")();
    assert.equal(opened.width, 512);
    assert.equal(opened.height, 256);
    await handlers.get("apply")(null, {
      masks: [
        {
          mask: await mask(50),
          options: { method: "blur", blur: 8, feather: 0 },
        },
      ],
      stamps: [],
    });
    await handlers.get("export")(null, 90);
    const rotated = await sharp(output).metadata();
    assert.equal(rotated.width, 512);
    assert.equal(rotated.height, 256);
    assert.ok(!rotated.orientation || rotated.orientation === 1);
    if (stamps.length) {
      input = path.join(dir, "p3.jpg");
      await sharp(pixels, { raw: { width: w, height: h, channels: 3 } })
        .withIccProfile("p3")
        .jpeg({ quality: 95 })
        .toFile(input);
      await handlers.get("open")();
      const png = await main.processMasks([], false, [
        { ...stamps[0], color: [255, 255, 255] },
      ]);
      const before = await sharp(input)
          .rotate()
          .withIccProfile("srgb")
          .raw()
          .toBuffer(),
        after = await sharp(png).removeAlpha().raw().toBuffer();
      for (const [x, y] of [
        [0, 0],
        [20, 200],
        [250, 120],
        [480, 220],
      ]) {
        const i = (y * w + x) * 3;
        assert.deepEqual(
          [...after.subarray(i, i + 3)],
          [...before.subarray(i, i + 3)],
        );
      }
      assert.ok((await sharp(png).metadata()).icc);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
