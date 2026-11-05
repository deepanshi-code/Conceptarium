// Gear trains. Meshing gears turn in opposite directions, and speed scales by the tooth ratio:
// ω_driven = ω_driver × T_driver / T_driven. Torque scales the other way (ideal gears, no friction).

/** Simple train: every gear meshes with the next. Returns signed rpm of each gear (+ = same way as the input). */
export function simpleTrain(teeth, rpmIn) {
  const rpm = [rpmIn];
  for (let i = 1; i < teeth.length; i++) rpm.push((-rpm[i - 1] * teeth[i - 1]) / teeth[i]);
  return rpm;
}

/**
 * Compound train with three shafts: A drives B; C is fixed to B's shaft; C drives D.
 * Returns signed rpm for [A, B, C, D].
 */
export function compoundTrain([a, b, c, d], rpmIn) {
  const rb = (-rpmIn * a) / b;
  return [rpmIn, rb, rb, (-rb * c) / d];
}

/** Speed ratio input/output and the matching (ideal) torque multiplier. */
export const ratio = (rpmIn, rpmOut) => Math.abs(rpmIn / rpmOut);
