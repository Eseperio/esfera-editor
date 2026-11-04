# Validation record

Date: 2026-11-02. Local development on macOS 15.5, Node.js 24.6.0, Electron 42.11.18, Sharp 0.35.5 and Three.js 0.181.2. This records evidence and limits, not a certification of every camera format or input device.

## Automated checks

`npm run check` passed: JavaScript and Python syntax checks, then 14 tests passed with no skips. The tests cover short rebound versus deliberate drag reversal, bounded and frame-independent inertia, wheel normalization, projection round trips, seam-aware perspective fitting, the frozen camera snapshot for subject selection, language changes, open-error feedback, two-mask processing and JPEG export, and spherical stamps across the seam with transparency. The compact-workspace revision adds numeric-field normalization and synchronization, center-ray invariance when changing projection, independent little-planet yaw/pitch, and inverse projection near poles and the seam at different aspect ratios. Export fixtures also exercise EXIF orientation and Display-P3-to-sRGB normalization. Native discard-dialog options, both languages, cancellation, acceptance and recovery after a dialog error are covered in the main-process integration test.

## High-resolution processing

A synthetic 11904 × 5952 panorama (70.9 megapixels) was opened with an 8192-pixel-wide initial preview. Two masks and a stamp at the nadir were applied, producing a 4096-pixel-wide applied preview. Export produced a JPEG at the original 11904 × 5952 dimensions, quality 90 and 4:4:4 chroma subsampling. EXIF, equirectangular XMP and an sRGB ICC profile were present; the source file's SHA-256 was unchanged. This checks processing and dimensions, not visual fidelity on a real Insta360 photograph or a general performance benchmark.

## Interaction and visual checks

The actual renderer and main-process handlers were exercised through a temporary local harness in Codex's embedded browser. Only Electron window/file-dialog integration was replaced by local test bridges. No production service was tested and no personal photographs were uploaded.

Observed successful flows in the first workstation revision included: empty-state tool hiding, opening a synthetic panorama, perspective and little-planet views, brush footprint preview, guided apply followed by navigation, JPEG quality selection and export, importing and applying a stamp at the current position, metadata search, switching English/Spanish, independent mask settings and delete/undo, wheel zoom over the viewer, and a blocking processing overlay with an accessible status message. That revision was compared with `design/workstation-concept.png`, an illustrative design concept, not an application screenshot. Its inspector tabs and floating projection controls have since been replaced by the compact workspace described below.

The native Vision helper produced a foreground mask from a public sample and reported no subject on the synthetic grid. The existing local LaMa model also completed inference.

## Native Electron follow-up

After the Mac was unlocked, the running Electron application was tested through its native interface using local synthetic fixtures. The following flows completed:

- Native open/save dialogs and return to the editor.
- Capture of the current perspective view, Vision foreground selection, and an aligned mask visibly covering the subject in a synthetic panorama containing a public sample photograph.
- Applying that selection with LaMa, with a centered blocking overlay, successful completion and restored controls. The resulting JPEG was saved through the native dialog and independently checked as 4096 × 2048, 4:4:4, with an ICC profile. This checks the workflow, not universal reconstruction quality.
- Imported circular stamp at the current view, live thumbnail changes for internal scale and horizontal offset, and a matching applied crop. Dragging still moved the panorama after both applying and exporting.
- Wheel input changed zoom from 65 to 49. A synthetic rapid drag exposed an excessive momentum cap; the maximum launch speed was reduced from 0.7 to 0.08 degrees/ms, bounding the exponential tail to 20.8 degrees while retaining the 3.12-degree minimum and rebound handling. A subsequent native drag and the new numerical regression checked the correction.
- Discard confirmation now uses localized native buttons. In Spanish, Cancelar retained the edited panorama and Cerrar returned to the empty state with tools hidden. The app was left running in that empty state.

These are automated native input checks; they do not reproduce the feel or complete event sequence of a physical multitouch trackpad.

## Compact workspace revision

The implementation plan is [COMPACT_UI_PLAN.md](COMPACT_UI_PLAN.md), with the illustrative reference [workstation-compact-v2.png](design/workstation-compact-v2.png). This is a refinement of the existing vanilla HTML/CSS interface; it adds no UI framework or CDN dependency.

The current renderer was exercised in the temporary local Electron bridge through Codex's embedded browser, at a reported 1910 × 1075 CSS viewport. Successful interactions included opening the synthetic grid with tools initially hidden, keeping multiple inspector sections open, switching ES/EN, changing a numeric brush value with the keyboard, adding a stamp, editing its scale and undoing it, typing a hexadecimal color, placing the stamp at the current view, and dragging little-planet view vertically and horizontally. The asymmetric grid visibly changed orientation in both axes. These checks used the real renderer and processing bridge, separate from the user's open native document.

The visual review found long control labels clipping in the narrow inspector. Visible labels were shortened while keeping full accessible names and tooltips; the repeated hidden Masks label was removed. Numeric fields also now derive translated accessible names from stable source keys. Code review caught a stale zoom control after closing a document, which now resets with the camera; the final renderer passed its syntax check after that correction.

### Design review ledger

| Point                 | Reference and implemented treatment                                                   | Evidence and status                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel organization    | Four stacked, independent sections replace three exclusive tabs.                      | Multiple sections opened together in the embedded browser. Masks and Removal start open; Stamps and Information start closed.                                                                                                                                                                 |
| Desktop density       | 42 px toolbar, 36 px rail, 292 px inspector, mostly 26 px buttons.                    | Implemented CSS dimensions; latest visual comparison at the reference's 1536 × 1024 dimensions remains pending.                                                                                                                                                                               |
| Typography and labels | 12 px base text, 13 px section titles, brief visible slider labels.                   | On-screen label clipping was corrected; full accessible labels and ES/EN switching were checked.                                                                                                                                                                                              |
| Palette and surfaces  | Graphite panels, recessed fields, thin dividers and a restrained blue accent.         | Shared CSS tokens match the plan. Final screenshot-to-reference color comparison remains pending.                                                                                                                                                                                             |
| Sliders and color     | Thin filled tracks, small thumbs, numeric entry, color swatch plus hexadecimal field. | Keyboard edits, stamp scale/undo and hex input were exercised; unit tests cover validation and synchronization.                                                                                                                                                                               |
| Viewer controls       | Projection presets and zoom share one compact footer.                                 | Visible and used in the local browser; final smallest-window visual pass remains pending.                                                                                                                                                                                                     |
| Copy and assets       | Existing ES/EN editor copy, with requested panel names and shorter control labels.    | Intentional changes include Apply instead of the longer preview label and brief size/framing labels. The illustrative road photo and generated logo are not shipped as UI; testing used an asymmetric synthetic panorama. The existing Esfera identity and real document viewer are retained. |

The concept was inspected with `view_image`. The final paired `view_image` comparison with a saved screenshot of this revision could not be completed: the computer-use session became unavailable and the embedded-browser tool returned "Local browser use is disabled in Work settings". No external Chrome/Playwright fallback was used. The prior `workstation-inspection.png` screenshot belongs to the earlier tabbed revision and is not evidence for this one. Full visual fidelity is therefore not claimed.

The native user window was not reloaded because it contained an unapplied selection. Native restart, the final JPEG-dialog interaction pass for the numeric control, and the minimum-window inspection remain pending. Earlier native apply/export results above are retained as earlier evidence, not represented as a fresh end-to-end check of this layout.

## Remaining manual checks

- Physical Mac trackpad: very short drags, terminal finger rebound, intentional reversal, pinch responsiveness and two-finger scroll across devices.
- Vision selection and manual correction on real camera photographs, including after resizing and leaving little-planet view. The camera-snapshot fix has automated regression coverage; the native end-to-end check used the initial perspective view of a synthetic fixture.
- The smallest native window size and final open-error feedback need a fresh visual pass; the latter has automated regression coverage.
- A clean setup on another machine, fresh LaMa download/compilation, proprietary Insta360 metadata and recognition by external 360 viewers. Windows and Linux are not validated targets.

Exports intentionally use sRGB. PNG intermediates avoid repeated lossy JPEG encoding, but the guided/LaMa working resolutions and the sRGB conversion still impose documented limits. See the README for details.

## Downloadable preview and model installer — 2026-11-04

`npm run check` passes 17 tests with no skips. The new model-manager tests cover a clean installation, single-job behavior, persistence across manager instances, reuse without another download, cancellation, compilation failure, staging cleanup, SHA-256 mismatch, response errors and download size limits.

An Apple Silicon macOS app was built with Electron-builder 26.18.0, Electron 42.11.18, PyInstaller 6.22.3, Python 3.13.0, OpenCV 5.0.0 and NumPy 2.5.4. The app includes its own Python/OpenCV runtime, native helpers and a custom SVG-derived PNG/ICNS icon, excluding model weights and development environments. Native helpers target macOS 14. The app has an ad-hoc signature; it is not Apple-notarized.

The packaged application visibly opened its empty editor window with the Local AI button through native computer use. Further window interaction failed in the computer-use tool, so the installer-dialog button flow and its progress display are not claimed as visually verified.

The packaged main-process handlers were then exercised with only Electron window/dialog integration replaced by local test doubles. In a new temporary per-user directory, the real installer downloaded the three model files, verified their hashes, compiled them with the bundled Core ML helper, loaded the compiled model and detected it as installed. Another install request reused it. The packaged Python executable then processed a synthetic 512 × 256 panorama with LaMa and a spherical stamp, and exported a JPEG with an ICC profile. No development Python interpreter or checkout model was used for that processing. This checks installation and processing on the build Mac, not visual reconstruction quality or a clean second-machine installation.

`codesign --verify --deep --strict` passed on the packaged bundle. The frozen Python runtime's self-check reported its embedded OpenCV/NumPy versions. A final release ZIP is accompanied by a SHA-256 checksum. Intel, Windows, Linux, physical trackpad behavior and first-launch Gatekeeper behavior on a separate Mac remain unvalidated. The generated icon was inspected locally with `view_image`.
