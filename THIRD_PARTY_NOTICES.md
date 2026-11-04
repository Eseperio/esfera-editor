# Third-party notices

Esfera uses Electron (MIT), Three.js (MIT), Sharp (Apache-2.0), exifr (MIT), OpenCV (Apache-2.0) and NumPy (BSD-3-Clause). Prettier (MIT) is a development tool. Their dependencies have their own licenses; consult their package distributions for complete notices.

The optional LaMa model is based on [LaMa](https://github.com/advimman/lama) (Apache-2.0); the Core ML conversion is available from [CoreMLaMa](https://github.com/mallman/CoreMLaMa). Model weights are not distributed in this repository. The pixel-buffer conversion in `native/LaMaRunner.swift` is adapted from [Erase](https://github.com/Dunebru/erase), MIT; the notice is in `native/ERASE-MIT-LICENSE.txt`.

Apple Vision and Core ML are system frameworks, subject to Apple's terms. They are not redistributed here.

Desktop packages also include Python (PSF license) and the PyInstaller bootloader (GPL with its bootloader exception). Their distribution notices, along with NumPy and OpenCV wheel notices, are copied to `Contents/Resources/licenses/python` in the macOS app. Electron's own notices and Chromium license bundle are included by the packager. Electron-builder is a build-time tool (MIT), not an application runtime dependency.

Build-tool license references: [PyInstaller's license and bootloader exception](https://pyinstaller.org/en/stable/license.html) and [Python's license](https://docs.python.org/3/license.html).
