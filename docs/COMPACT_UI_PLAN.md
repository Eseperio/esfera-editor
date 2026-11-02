# Compact desktop workspace revision

The user requested denser desktop controls and stacked side panels inspired by Resolve and Photoshop, plus independent orientation in little-planet view. The implementation reference is [workstation-compact-v2.png](design/workstation-compact-v2.png), an illustrative generated concept rather than an application screenshot. Preserve existing local processing and bilingual behavior. No UI framework migration or remote CDN is needed.

## Layout and component rules

- A 42-pixel application toolbar, 36-pixel left tool rail, central viewer, and approximately 292-pixel inspector. At a 960-pixel window retain a useful viewer and independently scroll the inspector. Native desktop is the target, not a mobile layout.
- Graphite surfaces (#202124), recessed fields (#18191c), hairline dividers (#37393e), readable text (#d8dadd), restrained blue (#86a9dc). Use 12-pixel interface text, 11-pixel secondary text, 13-pixel section titles, 26-pixel controls, 16-pixel consistent line icons, 3-pixel radii, and 8–10-pixel panel insets.
- Replace mutually exclusive Edit/Stamp/Info tabs with independently collapsible stacked sections: Masks, Removal, Stamps, Information. Masks and Removal start open. Keep multiple sections open simultaneously. Hide tools entirely without a document. Lists must not grow the whole window indefinitely.
- Masks retain enable/select/rename/delete/add and undo. Removal retains all existing methods and conditional settings. Stamps retain all placement, crop, color, circular-mask, enable and history behavior. Information retains search and grouped metadata.
- Dense range rows: label, narrow track, numeric field. Use explicit track/thumb styling and focus, disabled, keyboard and hover states. Numeric entry must validate min/max/step, share existing input logic, preview brush changes, preserve undo grouping, and stay synchronized after selecting masks/stamps, undo, language changes and preset changes. Do not add polling just to synchronize form fields.
- Stamp color uses a compact native swatch plus editable hexadecimal field. Keep browser/OS color selection available, validate edits and support undo. Stamp thumbnail and framing remain synchronized. An empty Stamps panel should show its add action without a wall of disabled settings.
- Place view presets and zoom in a single compact viewer footer that cannot overlap the scene or inspector controls. Keep the processing overlay centered and blocking, and the Apply action visible at the bottom of the inspector.
- Keep ES/EN labels, tooltips and accessible names. Existing controls may be relabeled more tersely (for example Apply), with explicit localization. Do not translate data values or filenames.
- Replace accumulated stylesheet overrides with coherent shared component rules; avoid retaining a second conflicting design system.

## Camera correction

The old projection interpolated latitude toward -90 degrees and ignored it at zoom zero. Projection parameters must change the lens only, leaving longitude and latitude untouched. A zoom/preset change must not reset the view; the user can tilt or rotate it in either projection. CPU projection/inverse, shader, contours, brush, stamp placement and Vision capture must use the same camera orientation. Calculate render parameters after integrating inertia. Tests cover center-ray invariance across zoom, independent pitch/yaw changes at zoom zero and inverse projection near poles and the longitude seam.

## Validation

Run relevant local checks, inspect the native app, and exercise stacked-panel disclosure, range and numeric input, mask/stamp switching, color, undo, subject selection, Apply/Export, and no-document state as appropriate to the changes. For little-planet view verify vertical and horizontal drags and repeated preset changes with an asymmetric synthetic panorama. Save actual screenshots outside the source tree and compare the concept and rendered result using view_image. Record typography, density, palette, panel arrangement and control treatment, with any intentional deviations and remaining physical-trackpad limits.
