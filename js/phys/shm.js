// Simple harmonic motion: a mass on a spring (exactly SHM) and a pendulum (SHM only for small swings).

export const springPeriod = (m, k) => 2 * Math.PI * Math.sqrt(m / k);
export const smallAnglePeriod = (L, g) => 2 * Math.PI * Math.sqrt(L / g);

/** Pendulum angle θ'' = −(g/L) sin θ, integrated with RK4. Returns a stepper keeping its own state. */
export function pendulum(L, g, theta0) {
  let th = theta0;
  let w = 0;
  const f = (t, om) => [om, -(g / L) * Math.sin(t)];
  return {
    get angle() { return th; },
    get omega() { return w; },
    step(dt) {
      const [a1, b1] = f(th, w);
      const [a2, b2] = f(th + (a1 * dt) / 2, w + (b1 * dt) / 2);
      const [a3, b3] = f(th + (a2 * dt) / 2, w + (b2 * dt) / 2);
      const [a4, b4] = f(th + a3 * dt, w + b3 * dt);
      th += ((a1 + 2 * a2 + 2 * a3 + a4) * dt) / 6;
      w += ((b1 + 2 * b2 + 2 * b3 + b4) * dt) / 6;
    },
  };
}

/** The true period for amplitude θ0, measured by simulating until the swing turns around twice. */
export function truePeriod(L, g, theta0, dt = 1e-4) {
  const p = pendulum(L, g, theta0);
  let t = 0;
  let turns = 0;
  let last = p.omega;
  let first = 0;
  while (turns < 2 && t < 1000) {
    p.step(dt);
    t += dt;
    if (last !== 0 && Math.sign(p.omega) !== Math.sign(last)) {
      turns += 1;
      if (turns === 1) first = t;
    }
    last = p.omega;
  }
  return 2 * (t - first); // two turnarounds are half a period apart
}
