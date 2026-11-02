/**
 * Boolean switches read from the page URL. `?debug=1` starts the battle
 * with the debug overlay showing; the D key toggles it afterwards. Seeds
 * live in `seed.ts`.
 */
export function debugFromSearch(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}
