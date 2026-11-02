# Esfera

[Español](README.es.md)

Esfera is an experimental, local editor for 2:1 equirectangular panoramas. Navigate in perspective, wide and little-planet views; paint or erase selections on independent masks; try several local removal methods; and place spherical stamps. It does not upload photos or require an account. JPEG, PNG and WebP panoramas up to 75 megapixels are supported. Export INSP or DNG from the camera software first; Esfera cannot read those formats directly.

## Setup

Requires macOS, Node.js 22.12 or newer, npm, Python 3 and the Xcode command-line tools. Vision subject selection needs macOS 14 or later. The helpers and LaMa have been exercised on macOS 15.5; the rest of the application has not been validated on Windows or Linux.

```sh
npm ci
npm run setup:python
npm run setup:native
npm start
```

OpenCV is used by guided processing and stamps. LaMa is optional. To download and compile the published Core ML conversion, run `npm run setup:lama`. The script checks SHA-256 hashes of its three source files, skips an already compiled model and does not commit weights. It downloads approximately 206 MiB and the compiled model requires additional space. Sources and licenses are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). A fresh download and compilation should be verified on the target system; an existing local model was used for development.

## Editing

Open a panorama, drag to look, use the wheel or trackpad pinch to zoom, and choose a projection preset. Paint and erase on the selected mask. Each mask has its own enabled state, method and settings; double-click a mask name to rename it. Subject selection uses Apple's local Vision foreground instances and can select multiple subjects; review and correct the resulting selection before applying. It is unavailable when its native helper cannot run. Add a stamp in the Stamp tab, import an image or use a solid color, place it on the sphere and adjust its outer size and inner framing. Apply the preview after changes; export uses the last applied state.

Guided and LaMa processing use a rectilinear view fitted to each mask. Very wide or incompatible selections must be split into masks. Guided processing uses a view up to 1600 pixels on its longest side; LaMa processes an 800 × 800 crop, so the edited region may lose detail. The viewer initially uses a texture no larger than 8192 pixels wide and GPU limits; the applied preview can be smaller. Neither is a full-resolution inspection of every large source. Review seams, poles, selection edges and stamp alignment carefully.

## Export and metadata

Export writes a different JPEG file at the source dimensions, with selectable quality 1–100 and 4:4:4 chroma subsampling. The processing pipeline uses lossless PNG intermediates and performs one final JPEG encoding. Sharp copies supported metadata from the source, including existing GPS location; pixel colors are converted to sRGB and the export carries an sRGB profile rather than the original ICC profile. Wide-gamut colors outside sRGB may be clipped; inspect and remove location separately before sharing if needed. EXIF, XMP and ICC preservation has been checked on synthetic fixtures, not every proprietary Insta360 tag or viewer. Embedded proprietary metadata is not guaranteed to be understood or preserved universally. Large images can require substantial memory and processing time.

The editor is experimental and does not promise privacy or reliable object removal. OCR, number-plate detection, face redaction and video are **not implemented**; see [ROADMAP.md](ROADMAP.md). Contributions are welcome: [CONTRIBUTING.md](CONTRIBUTING.md). Code is licensed under [MIT](LICENSE); dependencies retain their own licenses.

Run `npm run check` for syntax and local automated tests. Some tests exercise Python and are skipped if `.venv` has not been set up. Real trackpad gestures, large camera files and platform-specific flows require separate manual testing.
