# Esfera development

Esfera is a local 360 panorama editor. `main.js` owns file dialogs and processing, `renderer.js` owns the UI, `guided.py` handles perspective processing, `lib/` contains pure modules, and `native/` contains macOS helpers. Spherical coordinates use (cos(lat)cos(lon), sin(lat), cos(lat)sin(lon)); image u wraps at 360 degrees and v starts at the north pole. Run `npm run check` and relevant integration tests locally. Never commit personal images, model weights, binaries, credentials or exports. Do not test in production unless explicitly requested.

For code discovery, prefer codebase-memory-mcp graph tools when available. Index this repository first if the indexing tool is exposed and it is not indexed. If the graph is absent or insufficient, use scoped source searches and record that limitation; an empty graph result is not evidence that a feature is absent.
