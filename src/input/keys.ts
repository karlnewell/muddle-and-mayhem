/** Keyboard bindings (spec 4.3). Compared against `KeyboardEvent.key`, letters case-insensitively. */
export const SLOT_KEYS: readonly string[] = ['1', '2', '3', '4', '5'];
export const HOLD_KEY = 'h';
export const MEDIC_KEY = 'm';
export const SELECT_ALL_KEY = 's'; // selects the whole squad, standing and downed
export const VOLLEY_KEY = 'a'; // the whole standing squad attacks the enemy nearest the cursor
export const PAUSE_KEY = ' ';
export const MENU_KEY = 'Escape';
export const DEBUG_KEY = 'd'; // toggles the debug overlay; nothing else uses D

/**
 * The key name the app should see for a keyboard event. Digit keys are
 * taken from `code` (`Digit1`..`Digit5`) so Shift+2 still reads as '2' and
 * not '@'; everything else uses `key` as the browser reports it.
 */
export function keyFromEvent(code: string, key: string): string {
  if (/^Digit[1-5]$/.test(code)) {
    return code.slice('Digit'.length);
  }
  return key;
}
