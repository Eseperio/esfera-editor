import test from "node:test";
import assert from "node:assert/strict";
import {
  launchVelocity,
  integrateVelocity,
  normalizeWheel,
} from "../lib/navigation.mjs";
import {
  screenDirection,
  directionScreen,
  directionFromUV,
  direction,
  fitDirections,
  subjectView,
  uvFromDirection,
} from "../lib/projection.mjs";
test("inertia rejects short rebound but retains deliberate reversal and pause", () => {
  assert.ok(
    launchVelocity(
      [
        { dx: 3, dy: 0, t: 10, dt: 10 },
        { dx: -2, dy: 0, t: 25, dt: 15 },
      ],
      30,
    ).x > 0,
  );
  assert.ok(
    launchVelocity(
      [
        { dx: 20, dy: 0, t: 80, dt: 80 },
        { dx: -1, dy: 0, t: 100, dt: 20 },
      ],
      100,
    ).x > 0,
  );
  assert.ok(
    launchVelocity(
      [
        { dx: 20, dy: 0, t: 10, dt: 10 },
        { dx: -10, dy: 0, t: 30, dt: 20 },
      ],
      35,
    ).x < 0,
  );
  assert.ok(
    launchVelocity(
      [
        { dx: 5, dy: 0, t: 50, dt: 50 },
        { dx: -10, dy: 0, t: 100, dt: 50 },
      ],
      100,
    ).x < 0,
  );
  assert.equal(launchVelocity([{ dx: 30, dy: 0, t: 0 }], 160).x, 0);
});
test("inertia integration is frame independent", () => {
  let positions = [];
  for (const fps of [30, 60, 120]) {
    let v = 1,
      x = 0;
    for (let i = 0; i < fps; i++) {
      let r = integrateVelocity(v, 1000 / fps);
      x += r.distance;
      v = r.velocity;
    }
    positions.push(x);
  }
  assert.ok(Math.max(...positions) - Math.min(...positions) < 1e-9);
});
test("wheel modes and projection round trip", () => {
  assert.equal(normalizeWheel({ deltaY: 2, deltaMode: 1 }), 32);
  for (const zoom of [0, 15, 30, 65, 100])
    for (const x of [-0.7, 0, 0.7])
      for (const y of [-0.6, 0, 0.6]) {
        const d = screenDirection(x, y, 1.4, 123, 20, zoom),
          p = directionScreen(d, 1.4, 123, 20, zoom);
        assert.ok(Math.abs(p[0] - x) < 1e-8 && Math.abs(p[1] - y) < 1e-8);
      }
  assert.equal(directionScreen([-1, 0, 0], 1, 0, 0, 65), null);
  for (const u of [0.001, 0.25, 0.999]) {
    let p = uvFromDirection(directionFromUV(u, 0.4));
    assert.ok(Math.abs(p[0] - u) < 1e-9);
  }
});

test("fit perspective over seam and reject opposing selections", () => {
  const view = fitDirections([direction(359, 5), direction(1, 4)], 1.6);
  assert.ok(Math.abs(view.lon) < 2);
  assert.ok(view.fov >= 25 && view.fov < 30);
  assert.throws(() => fitDirections([direction(0, 0), direction(180, 0)], 1));
});

test("subject view snapshots the exact perspective and preserves little-planet center", () => {
  let camera = { lon: 123, lat: 15, zoom: 10, aspect: 1.5 };
  const before = screenDirection(
    0,
    0,
    camera.aspect,
    camera.lon,
    camera.lat,
    camera.zoom,
  );
  const captured = subjectView(
    camera.lon,
    camera.lat,
    camera.zoom,
    camera.aspect,
  );
  camera = { lon: 50, lat: 40, zoom: 95, aspect: 2 };
  const after = screenDirection(
    0,
    0,
    captured.aspect,
    captured.lon,
    captured.lat,
    captured.zoom,
  );
  assert.ok(before.every((v, i) => Math.abs(v - after[i]) < 1e-12));
  assert.equal(captured.zoom, 30);
  assert.equal(captured.aspect, 1.5);
  assert.equal(captured.lon, 123);
  assert.equal(Object.isFrozen(captured), true);
  const perspective = subjectView(5, 20, 65, 1.2);
  assert.equal(perspective.lat, 20);
  assert.equal(perspective.fov, 70);
});

test("fast drags retain direction and limit the inertial tail", () => {
  const velocity = launchVelocity([{ dx: 80, dy: 0, t: 16, dt: 16 }], 16);
  assert.ok(velocity.x > 0);
  assert.equal(velocity.y, 0);
  assert.ok(velocity.x <= 0.08);
  let x = 0,
    v = velocity.x;
  for (let i = 0; i < 1200; i++) {
    const step = integrateVelocity(v, 1000 / 120);
    x += step.distance;
    v = step.velocity;
  }
  assert.ok(x <= 20.8 + 1e-9);
  assert.ok(x > 20.79);
});

test("projection changes never recenter and planet responds to yaw and pitch", () => {
  for (const [lon, lat] of [
    [0, 0],
    [359, 42],
    [120, -89.9],
    [270, 89.9],
  ]) {
    const expected = direction(lon, lat);
    for (const zoom of [0, 5, 15, 29, 30, 65, 100, 0]) {
      const center = screenDirection(0, 0, 1.7, lon, lat, zoom);
      assert.ok(center.every((v, i) => Math.abs(v - expected[i]) < 1e-12));
    }
  }
  const center = screenDirection(0, 0, 1.5, 30, 20, 0);
  const yaw = screenDirection(0, 0, 1.5, 40, 20, 0);
  const pitch = screenDirection(0, 0, 1.5, 30, 30, 0);
  assert.ok(Math.hypot(...center.map((v, i) => v - yaw[i])) > 0.1);
  assert.ok(Math.hypot(...center.map((v, i) => v - pitch[i])) > 0.1);
});

test("projection inverse round trips stereo at poles, seam and viewport aspects", () => {
  for (const aspect of [0.7, 1, 2])
    for (const [lon, lat] of [
      [359.9, 0],
      [0.1, 0],
      [45, 90],
      [225, -90],
      [179, 89.9],
    ])
      for (const zoom of [0, 15, 30, 65, 100])
        for (const [x, y] of [
          [-0.8, -0.7],
          [0, 0],
          [0.75, 0.6],
        ]) {
          const ray = screenDirection(x, y, aspect, lon, lat, zoom);
          const screen = directionScreen(ray, aspect, lon, lat, zoom);
          assert.ok(
            screen &&
              Math.abs(screen[0] - x) < 1e-8 &&
              Math.abs(screen[1] - y) < 1e-8,
            `zoom=${zoom} lon=${lon} lat=${lat} aspect=${aspect}`,
          );
        }
});
