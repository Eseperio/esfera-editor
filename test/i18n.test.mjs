import test from "node:test";
import assert from "node:assert/strict";
test("language selection translates status and survives switching back", async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.document = {
    documentElement: {},
    body: {},
    createTreeWalker: () => ({ nextNode: () => false }),
    querySelectorAll: () => [],
  };
  const { t, setLanguage, translateLive } = await import("../lib/i18n.mjs");
  setLanguage("en");
  assert.equal(t("Sin metadatos"), "No metadata");
  assert.equal(
    t("La selección es demasiado amplia; divídela en máscaras."),
    "The selection is too wide; split it into masks.",
  );
  setLanguage("es");
  assert.equal(translateLive("No metadata"), "Sin metadatos");
  assert.equal(values.get("esfera-language"), "es");
});
