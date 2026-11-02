export function normalizeRangeValue(value, min, max, step) {
  const n = Number(value);
  if (value === "" || !Number.isFinite(n)) return null;
  const amount = Math.max(min, Math.min(max, n));
  const snapped = min + Math.round((amount - min) / step) * step;
  return Number(Math.max(min, Math.min(max, snapped)).toFixed(8));
}
export function bindRange(range, { beforeChange = () => {}, label = "" } = {}) {
  const number = document.createElement("input");
  number.type = "number";
  number.className = "range-number";
  number.min = range.min;
  number.max = range.max;
  number.step = range.step || "1";
  number.setAttribute("aria-label", label);
  range.insertAdjacentElement("afterend", number);
  const sync = () => {
    number.value = range.value;
    number.disabled = range.disabled;
    const min = Number(range.min),
      max = Number(range.max);
    range.style.setProperty(
      "--range-fill",
      `${((Number(range.value) - min) / (max - min)) * 100}%`,
    );
  };
  range.addEventListener("input", sync);
  number.addEventListener("change", () => {
    const value = normalizeRangeValue(
      number.value,
      Number(range.min),
      Number(range.max),
      Number(range.step || 1),
    );
    if (value === null) {
      sync();
      return;
    }
    if (value !== Number(range.value)) {
      beforeChange();
      range.value = String(value);
      range.dispatchEvent(new Event("input", { bubbles: true }));
    }
    sync();
  });
  sync();
  return { number, sync, label };
}
