# Building and releasing Esfera

The current binary target is macOS 14+ on Apple Silicon. The stack is portable, but native Core ML/Vision integration and the frozen Python runtime must be built and tested for each target. Do not label this build universal or publish untested Windows/Linux binaries.

## Build

On an Apple Silicon Mac with Node.js, Python and Xcode command-line tools:

```sh
npm ci
npm run setup:python
.venv/bin/python -m pip install -r requirements-build.txt
npm run check
npm run build:mac
```

`dist/Esfera-<version>-macOS-arm64.zip` contains Esfera.app with Electron, Sharp, a frozen Python/OpenCV/NumPy runtime, native helpers, icon and license notices. It does not include model weights, a developer `.venv`, source photographs or exports. The build scripts regenerate the icon and native helpers.

The current preview is ad-hoc signed, with notarization explicitly disabled. `codesign --verify --deep --strict dist/mac-arm64/Esfera.app` checks bundle integrity; it does not certify Developer ID trust or Gatekeeper acceptance. A signed, notarized release needs the maintainer's Apple Developer signing identity and notarization credentials. Do not distribute credentials or disable Gatekeeper in build or installation scripts.

## Local model installation

The app downloads only the three files in `models/lama-manifest.json`. Downloads are size-limited and SHA-256 checked, compiled and loaded by the bundled native helper, then moved into place. Partial and failed installations are removed; the active model is not replaced until the new one has been validated. A second installation request shares the first job. Cancellation aborts the download or helper process.

Installed models live in Electron's per-user data folder under `models/lama-v1/LaMa.mlmodelc`, outside the signed application bundle. Updates preserve that folder. Development runs also recognize the legacy model in the checkout. The public application has no dependency on that checkout and does not require Xcode to compile a downloaded model: it uses Core ML's runtime compiler.

## Validate and publish

Before publishing, check the extracted app, icon and startup; missing-model detection; a fresh download, compilation and cached detection; local AI processing and JPEG export; and offline handling/cancellation. Use synthetic or explicitly disposable local fixtures. Record GUI checks separately from processing tests. Never claim the preview has been tested on a clean machine if it has only been tested on the build Mac.

Create a SHA-256 file for the final ZIP. Publish a GitHub prerelease against the exact source commit and attach the ZIP and checksum. Release notes must state architecture, minimum macOS version, model download size, signing/notarization status and validation limits. Do not upload weights or the working app directory to Git history.
