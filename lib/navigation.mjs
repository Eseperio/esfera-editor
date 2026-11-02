export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function normalizeWheel(event, height = 800) {
  return clamp(
    event.deltaY *
      (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1),
    -100,
    100,
  );
}
export function launchVelocity(samples, now, scale = 0.16) {
  const recent = samples.filter((s) => now - s.t <= 130);
  if (!recent.length || now - recent.at(-1).t >= 140) return { x: 0, y: 0 };
  let chosen = recent;
  const sum = (a) =>
    a.reduce((v, s) => ({ x: v.x + s.dx, y: v.y + s.dy }), { x: 0, y: 0 });
  // Find the most recent reversal against the preceding dominant segment.
  for (let i = recent.length - 1; i > 0; i--) {
    const head = sum(recent.slice(0, i)),
      tail = sum(recent.slice(i));
    const h = Math.hypot(head.x, head.y),
      e = Math.hypot(tail.x, tail.y);
    if (head.x * tail.x + head.y * tail.y < 0) {
      if (
        recent.at(-1).t - recent[i].t <= 45 &&
        e < 4 &&
        (e < 2.5 || e < h * 0.25)
      )
        chosen = recent.slice(0, i);
      else chosen = recent.slice(i);
      break;
    }
  }
  const delta = sum(chosen),
    distance = Math.hypot(delta.x, delta.y);
  if (distance < 2) return { x: 0, y: 0 };
  const duration = Math.max(
    16,
    chosen.at(-1).t - (chosen[0].t - (chosen[0].dt || 16)),
  );
  const speed = clamp((distance * scale) / duration, 0.012, 0.08);
  return { x: (delta.x / distance) * speed, y: (delta.y / distance) * speed };
}
export function integrateVelocity(v, dt, tau = 260) {
  const decay = Math.exp(-dt / tau);
  return { distance: v * tau * (1 - decay), velocity: v * decay };
}
