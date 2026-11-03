/**
 * Which build is running, so a playtest report can be tied to its commit.
 * `vite.config.ts` calls `formatBuildVersion` at build time and injects the
 * result as `__BUILD_VERSION__` through `define`; the game reads it as
 * `BUILD_VERSION`, which is `dev` wherever nothing was injected (unit tests).
 */
declare const __BUILD_VERSION__: string | undefined;

export const BUILD_VERSION: string = typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'dev';

/**
 * `<package version>+<short sha> <UTC date>`, for example
 * `0.1.0+b11b13d 2026-11-03`. `readSha` runs `git rev-parse --short HEAD`;
 * when it throws or returns something that is not a hex SHA, the commit
 * reads `dev`.
 */
export function formatBuildVersion(version: string, readSha: () => string, now: Date): string {
  let sha = 'dev';
  try {
    const out = readSha().trim();
    if (/^[0-9a-f]{4,40}$/.test(out)) {
      sha = out;
    }
  } catch {
    // no git, or not a repository: keep dev
  }
  return `${version}+${sha} ${now.toISOString().slice(0, 10)}`;
}
