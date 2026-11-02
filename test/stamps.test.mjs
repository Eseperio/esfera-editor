import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
const run = promisify(execFile),
  python = path.resolve(".venv/bin/python");
test(
  "spherical stamp crosses seam, keeps distant pixels and preserves transparency",
  { skip: !existsSync(python) },
  async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "esfera-stamp-test-"));
    try {
      const image = path.join(dir, "input.png"),
        asset = path.join(dir, "stamp.png"),
        output = path.join(dir, "out.png");
      await sharp({
        create: {
          width: 360,
          height: 180,
          channels: 3,
          background: { r: 30, g: 40, b: 50 },
        },
      })
        .png()
        .toFile(image);
      const rgba = Buffer.alloc(40 * 40 * 4);
      for (let y = 0; y < 40; y++)
        for (let x = 0; x < 40; x++) {
          let i = (y * 40 + x) * 4;
          rgba[i] = 255;
          rgba[i + 3] = x < 20 ? 255 : 0;
        }
      await sharp(rgba, { raw: { width: 40, height: 40, channels: 4 } })
        .png()
        .toFile(asset);
      const stamp = {
        lon: 0,
        lat: 0,
        size: 40,
        rotation: 0,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        circle: true,
        enabled: true,
        path: asset,
      };
      await run(python, [
        "stamps.py",
        JSON.stringify({ image, output, stamps: [stamp] }),
      ]);
      const pixels = await sharp(await readFile(output))
        .raw()
        .toBuffer();
      const rgb = (x, y) => [
        ...pixels.subarray((y * 360 + x) * 3, (y * 360 + x) * 3 + 3),
      ];
      assert.deepEqual(rgb(180, 90), [30, 40, 50]);
      assert.notDeepEqual(rgb(355, 90), [30, 40, 50]);
      assert.deepEqual(rgb(5, 90), [30, 40, 50]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
