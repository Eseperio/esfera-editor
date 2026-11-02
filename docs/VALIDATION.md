# Validation record

Date: 2026-11-02. Local development on macOS 15.5, Node.js 24.6.0, Electron 42.11.18, Sharp 0.35.5 and Three.js 0.181.2. This records evidence and limits, not a certification of every camera format or input device.

## Automated checks

`npm run check` passed: JavaScript and Python syntax checks, then 9 tests passed with no skips. The tests cover short rebound versus deliberate drag reversal, frame-independent inertia, wheel normalization, projection round trips, seam-aware perspective fitting, the frozen camera snapshot for subject selection, language changes, open-error feedback, two-mask processing and JPEG export, and spherical stamps across the seam with transparency. Export fixtures also exercise EXIF orientation and Display-P3-to-sRGB normalization.

## High-resolution processing

A synthetic 11904 × 5952 panorama (70.9 megapixels) was opened with an 8192-pixel-wide initial preview. Two masks and a stamp at the nadir were applied, producing a 4096-pixel-wide applied preview. Export produced a JPEG at the original 11904 × 5952 dimensions, quality 90 and 4:4:4 chroma subsampling. EXIF, equirectangular XMP and an sRGB ICC profile were present; the source file's SHA-256 was unchanged. This checks processing and dimensions, not visual fidelity on a real Insta360 photograph or a general performance benchmark.

## Interaction and visual checks

The actual renderer and main-process handlers were exercised through a temporary local harness in Codex's embedded browser. Only Electron window/file-dialog integration was replaced by local test bridges. No production service was tested and no personal photographs were uploaded.

Observed successful flows included: empty-state tool hiding, opening a synthetic panorama, perspective and little-planet views, brush footprint preview, guided apply followed by navigation, JPEG quality selection and export, importing and applying a stamp at the current position, metadata search, switching English/Spanish, independent mask settings and delete/undo, wheel zoom over the viewer, and a blocking processing overlay with an accessible status message. The dark workstation layout was compared with `design/workstation-concept.png`; that file is an illustrative design concept, not an application screenshot. The implemented rail, inspector tabs and floating projection controls are a compact adaptation.

The native Vision helper produced a foreground mask from a public sample and reported no subject on the synthetic grid. The existing local LaMa model also completed inference. These helper checks do not establish complete end-to-end subject-selection quality in the UI.

## Remaining manual checks

- Physical Mac trackpad: very short drags, terminal finger rebound, intentional reversal, pinch responsiveness and two-finger scroll across devices.
- Full native Electron flows, especially dirty-document close/cancel and file dialogs. The host was locked during testing; a later embedded-browser confirmation dialog blocked further input automation.
- End-to-end Vision capture, backprojection and manual correction on real camera photographs, including after resizing and leaving little-planet view. The final camera-snapshot fix has automated regression coverage, but its complete UI flow remains to be checked.
- The final live stamp crop thumbnail, last localized tooltips/error feedback, and the smallest native window size need a fresh visual pass. Earlier main flows were checked before these small final fixes.
- A clean setup on another machine, fresh LaMa download/compilation, proprietary Insta360 metadata and recognition by external 360 viewers. Windows and Linux are not validated targets.

Exports intentionally use sRGB. PNG intermediates avoid repeated lossy JPEG encoding, but the guided/LaMa working resolutions and the sRGB conversion still impose documented limits. See the README for details.
