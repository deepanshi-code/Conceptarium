// PID control of a drone's altitude. The motors push up with thrust u (per unit mass); gravity pulls down.
// u = Kp·e + Ki·∫e dt + Kd·de/dt, with e = target − height. Thrust can't be negative or above a limit.

export const GRAVITY = 9.81;
export const MAX_THRUST = 40;

export function createDrone({ Kp, Ki, Kd }) {
  const s = { y: 0, v: 0, integral: 0, prevError: null, t: 0 };
  return {
    state: s,
    gains: { Kp, Ki, Kd },
    step(target, dt) {
      const { Kp: P, Ki: I, Kd: D } = this.gains;
      const e = target - s.y;
      const de = s.prevError === null ? 0 : (e - s.prevError) / dt;
      s.prevError = e;
      let u = P * e + I * s.integral + D * de;
      const clamped = Math.min(MAX_THRUST, Math.max(0, u));
      // Anti-windup: stop integrating while the motors are saturated in the same direction.
      if (u === clamped || Math.sign(e) !== Math.sign(u - clamped)) s.integral += e * dt;
      u = clamped;
      s.v += (u - GRAVITY) * dt;
      s.y += s.v * dt;
      if (s.y < 0) { s.y = 0; s.v = Math.max(0, s.v); } // the ground
      s.t += dt;
      return { y: s.y, u, e };
    },
  };
}

/** Run a step response for `seconds` and measure it. */
export function stepResponse(gains, target = 5, seconds = 20, dt = 0.002) {
  const d = createDrone(gains);
  let peak = 0;
  const trace = [];
  for (let t = 0; t < seconds; t += dt) {
    const { y } = d.step(target, dt);
    peak = Math.max(peak, y);
    trace.push([t, y]);
  }
  const final = trace.at(-1)[1];
  let settle = 0;
  for (let k = trace.length - 1; k >= 0; k--) if (Math.abs(trace[k][1] - target) > 0.02 * target) { settle = trace[k][0]; break; }
  return { final, steadyError: target - final, overshoot: Math.max(0, ((peak - target) / target) * 100), settle };
}
