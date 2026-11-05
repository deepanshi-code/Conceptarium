// Ideal gas law: PV = nRT. With V in litres and R = 8.314 J/(mol·K), P comes out in kPa.

export const R = 8.314;
export const pressure = (n, T, V) => (n * R * T) / V; // kPa
export const volume = (n, T, P) => (n * R * T) / P; // L
/** Root-mean-square molecular speed, v = √(3RT/M), with M in kg/mol. */
export const rmsSpeed = (T, M) => Math.sqrt((3 * R * T) / M);
