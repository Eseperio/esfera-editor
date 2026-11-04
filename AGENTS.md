# Esfera development

Esfera is a local 360 panorama editor. `main.js` owns file dialogs and processing, `renderer.js` owns the UI, `guided.py` handles perspective processing, `lib/` contains pure modules, and `native/` contains macOS helpers. Spherical coordinates use (cos(lat)cos(lon), sin(lat), cos(lat)sin(lon)); image u wraps at 360 degrees and v starts at the north pole. Run `npm run check` and relevant integration tests locally. Never commit personal images, model weights, binaries, credentials or exports. Do not test in production unless explicitly requested.

For code discovery, prefer codebase-memory-mcp graph tools when available. Index this repository first if the indexing tool is exposed and it is not indexed. If the graph is absent or insufficient, use scoped source searches and record that limitation; an empty graph result is not evidence that a feature is absent.

Distribution uses `npm run build:mac`, a frozen `processing.py` entry point, native helpers under packaged `Resources/runtime`, and a model manager in `lib/model-manager.cjs`. Never put downloaded weights in a release ZIP or Git history. Model installs must stay in per-user data, validate the pinned manifest hashes before compiling, and publish only validated compiled output. Packaging and signing instructions are in `docs/RELEASING.md`.
