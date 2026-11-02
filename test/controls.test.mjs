import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRangeValue } from "../lib/controls.mjs";
test("numeric range entries reject invalid values, clamp and snap to the declared step", () => {
  assert.equal(normalizeRangeValue("", 0, 100, 1), null);
  assert.equal(normalizeRangeValue("abc", 0, 100, 1), null);
  assert.equal(normalizeRangeValue("120", 0, 100, 1), 100);
  assert.equal(normalizeRangeValue("-5", 0, 100, 1), 0);
  assert.equal(normalizeRangeValue("0.37", -2, 2, 0.05), 0.35);
  assert.equal(normalizeRangeValue("4.96", 0.1, 5, 0.1), 5);
});

test("numeric edit dispatches a single range change and sync restores disabled state", async () => {
  const { bindRange } = await import("../lib/controls.mjs");
  function element() {
    const listeners = {};
    return {
      value: "",
      disabled: false,
      style: { setProperty() {} },
      setAttribute() {},
      addEventListener(type, fn) {
        (listeners[type] ??= []).push(fn);
      },
      dispatchEvent(event) {
        for (const fn of listeners[event.type] || []) fn(event);
      },
    };
  }
  const range = element();
  Object.assign(range, {
    min: "0",
    max: "100",
    step: "1",
    value: "35",
    insertAdjacentElement(_position, node) {
      this.number = node;
    },
  });
  globalThis.document = { createElement: () => element() };
  let snapshots = 0,
    inputs = 0;
  range.addEventListener("input", () => inputs++);
  const binding = bindRange(range, {
    label: "Brush",
    beforeChange: () => snapshots++,
  });
  binding.number.value = "42";
  binding.number.dispatchEvent(new Event("change"));
  assert.equal(range.value, "42");
  assert.equal(snapshots, 1);
  assert.equal(inputs, 1);
  binding.number.value = "";
  binding.number.dispatchEvent(new Event("change"));
  assert.equal(binding.number.value, "42");
  assert.equal(snapshots, 1);
  range.value = "70";
  range.disabled = true;
  binding.sync();
  assert.equal(binding.number.value, "70");
  assert.equal(binding.number.disabled, true);
});
