/**
 * Deterministic pseudo-random generator (mulberry32).
 * Used so chart series and generated table rows are identical on every
 * render/build — no flicker, no SSR hydration mismatch.
 */
export function seeded(seed) {
  let a = seed
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)]
export const between = (rand, min, max) => min + rand() * (max - min)
export const round = (n, dp = 0) => Number(n.toFixed(dp))
