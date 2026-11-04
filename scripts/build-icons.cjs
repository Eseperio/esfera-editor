const sharp = require("sharp");
const fs = require("fs/promises");
const { execFileSync } = require("child_process");
(async () => {
  await fs.mkdir("build/icon.iconset", { recursive: true });
  await sharp("assets/icon.svg")
    .resize(1024, 1024)
    .png()
    .toFile("assets/icon.png");
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      await sharp("assets/icon.svg")
        .resize(size * scale, size * scale)
        .png()
        .toFile(
          `build/icon.iconset/icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`,
        );
    }
  }
  if (process.platform === "darwin")
    execFileSync("iconutil", [
      "-c",
      "icns",
      "build/icon.iconset",
      "-o",
      "assets/icon.icns",
    ]);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
