const { execFileSync } = require("child_process");
if (process.platform !== "darwin")
  throw Error("Build the macOS distribution on macOS.");
const run = (program, args) =>
  execFileSync(program, args, { stdio: "inherit" });
run(process.execPath, ["scripts/build-icons.cjs"]);
run("sh", ["scripts/setup-native.sh"]);
run("sh", ["scripts/build-python.sh"]);
run(process.execPath, [
  "node_modules/electron-builder/cli.js",
  "--mac",
  "zip",
  "--arm64",
  "--publish",
  "never",
]);
