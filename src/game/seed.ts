/**
 * Battle seeds. `?seed=N` in the URL pins a battle (the Playwright test and
 * bug reports use it); otherwise a random 32-bit seed from a caller-supplied
 * source (`Math.random` in the browser, fine outside the sim). A rematch
 * from a fixed seed uses seed plus one so it stays reproducible.
 */
export interface SeedChoice {
  seed: number;
  /** True when the seed came from the URL. */
  fixed: boolean;
}

const TWO_32 = 4294967296;

function randomSeed(random: () => number): number {
  return Math.floor(random() * TWO_32) >>> 0;
}

export function seedFromSearch(search: string, random: () => number): SeedChoice {
  const params = new URLSearchParams(search);
  const raw = params.get('seed');
  if (raw !== null && /^\d+$/.test(raw)) {
    return { seed: Number(raw) >>> 0, fixed: true };
  }
  return { seed: randomSeed(random), fixed: false };
}

export function nextSeed(previous: SeedChoice, random: () => number): SeedChoice {
  if (previous.fixed) {
    return { seed: (previous.seed + 1) >>> 0, fixed: true };
  }
  return { seed: randomSeed(random), fixed: false };
}
