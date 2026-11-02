import test from "node:test";
import assert from "node:assert/strict";
import { setOpenFeedback } from "../lib/open-feedback.mjs";
test("an open failure reaches the empty state and cancellation clears it", () => {
  const inspector = { textContent: "" };
  const empty = {
    textContent: "",
    classList: {
      toggle(_name, value) {
        this.error = value;
      },
    },
  };
  setOpenFeedback(inspector, empty, "Invalid panorama", true);
  assert.equal(empty.textContent, "Invalid panorama");
  assert.equal(empty.classList.error, true);
  setOpenFeedback(inspector, empty, "");
  assert.equal(empty.textContent, "");
  assert.equal(empty.classList.error, false);
});
