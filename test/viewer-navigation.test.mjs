import test from "node:test";
import assert from "node:assert/strict";
import {
  navigationScale,
  screenDirection,
  angularDistance,
} from "../lib/projection.mjs";
import {
  launchVelocity,
  integrateVelocity,
  limitPanVelocity,
} from "../lib/navigation.mjs";

test("drag sensitivity follows the rendered projection and viewport size at every zoom", () => {
  for (const height of [420, 800, 1600]) {
    for (const aspect of [1, 2]) {
      for (const zoom of [0, 15, 30, 65, 100]) {
        const center = screenDirection(0, 0, aspect, 15, 0, zoom);
        const horizontal = screenDirection(
          1 / (height * aspect),
          0,
          aspect,
          15,
          0,
          zoom,
        );
        const vertical = screenDirection(0, 1 / height, aspect, 15, 0, zoom);
        const scale = navigationScale(zoom, height);
        assert.ok(
          Math.abs(angularDistance(center, horizontal) * 2 - scale) < 0.0001,
        );
        assert.ok(
          Math.abs(angularDistance(center, vertical) * 2 - scale) < 0.0001,
        );
      }
    }
    assert.ok(navigationScale(100, height) < navigationScale(65, height) * 0.4);
  }
  assert.equal(navigationScale(65, 800), navigationScale(65, 1600) * 2);
});

test("release momentum keeps its screen speed and minimum travel when zooming in", () => {
  for (const dx of [3, 80]) {
    const launch = launchVelocity([{ dx, dy: 0, t: 40, dt: 40 }], 40, 1);
    let distances = [];
    for (const zoom of [65, 100]) {
      const scale = navigationScale(zoom, 800);
      const velocity = limitPanVelocity(launch.x, scale);
      const angularTravel = integrateVelocity(velocity, 10000).distance * scale;
      distances.push(angularTravel / scale);
    }
    assert.ok(distances[0] >= 19.4);
    assert.ok(Math.abs(distances[0] - distances[1]) < 1e-9);
  }
});

test("little-planet momentum stays within the previous maximum angular tail", () => {
  for (const zoom of [0, 15, 30, 65, 100]) {
    const scale = navigationScale(zoom, 420);
    for (const speed of [-0.5, 0.5]) {
      const velocity = limitPanVelocity(speed, scale);
      assert.ok(Math.abs(velocity * scale) <= 0.08 + 1e-12);
      const tail = integrateVelocity(velocity, 10000).distance * scale;
      assert.ok(Math.abs(tail) <= 20.8 + 1e-9);
    }
  }
});
