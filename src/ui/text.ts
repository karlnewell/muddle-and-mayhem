/** Text helpers for the HUD and screens. */
import { TICK_RATE } from '../sim';

/** Ticks as `mm:ss`. */
export function formatClock(ticks: number): string {
  const totalSeconds = Math.floor(ticks / TICK_RATE);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
