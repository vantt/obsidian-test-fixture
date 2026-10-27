// mulberry32: small seeded PRNG so reruns produce identical files. Do not change: output depends on it.
export function createRng(initial) {
  let seed = initial;
  const rand = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const some = (a, n) => Array.from({ length: n }, () => pick(a));
  const chance = (p) => rand() < p;
  return { rand, pick, some, chance };
}
