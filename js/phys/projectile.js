// Projectile motion from height h0, with optional air drag (force ∝ v², coefficient k per unit mass).
// Without drag the closed forms hold: range = v² sin 2θ / g from the ground.

export const PLANETS = {
  earth: { name: 'Earth', g: 9.81 },
  moon: { name: 'Moon', g: 1.62 },
  mars: { name: 'Mars', g: 3.71 },
  jupiter: { name: 'Jupiter', g: 24.79 },
};

/** Samples [{t, x, y, vx, vy}] until the ball lands (y back to 0), plus range, peak height and flight time. */
export function trajectory({ v, angle, g = 9.81, h0 = 0, k = 0, dt = 0.002 }) {
  const a = (angle * Math.PI) / 180;
  let vx = v * Math.cos(a);
  let vy = v * Math.sin(a);
  let x = 0;
  let y = h0;
  let t = 0;
  let peak = h0;
  const pts = [{ t, x, y, vx, vy }];
  const accel = (vxi, vyi) => {
    const s = Math.hypot(vxi, vyi);
    return [-k * s * vxi, -g - k * s * vyi];
  };
  while (t < 600) {
    // Midpoint (RK2) step: accurate enough that the no-drag case matches the formula to < 0.1%.
    const [ax1, ay1] = accel(vx, vy);
    const mvx = vx + (ax1 * dt) / 2;
    const mvy = vy + (ay1 * dt) / 2;
    const [ax2, ay2] = accel(mvx, mvy);
    const nx = x + mvx * dt;
    const ny = y + mvy * dt;
    if (ny < 0) {
      const f = y / (y - ny); // land exactly on y = 0
      x += (nx - x) * f;
      t += dt * f;
      vx += ax2 * dt * f;
      vy += ay2 * dt * f;
      pts.push({ t, x, y: 0, vx, vy });
      break;
    }
    x = nx;
    y = ny;
    vx += ax2 * dt;
    vy += ay2 * dt;
    t += dt;
    peak = Math.max(peak, y);
    pts.push({ t, x, y, vx, vy });
  }
  return { points: pts, range: x, peak, time: t };
}
