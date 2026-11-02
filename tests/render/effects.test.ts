import { describe, expect, it } from 'vitest';
import { effectsFromEvents, pruneEffects } from '../../src/render/effects';
import { HIT_FLASH_TICKS, IMPACT_EFFECT_TICKS, JAM_LABEL_TICKS } from '../../src/render/renderConstants';
import type { BattleEvent } from '../../src/sim';

describe('effectsFromEvents', () => {
  it('turns an impact into a ring at its point that lasts IMPACT_EFFECT_TICKS', () => {
    const events: BattleEvent[] = [{ kind: 'impact', x: 100, y: 50, weapon: 'launcher', radius: 40 }];
    const fx = effectsFromEvents(events, 10);
    expect(fx).toEqual([{ kind: 'impact', x: 100, y: 50, radius: 40, weapon: 'launcher', start: 10, until: 10 + IMPACT_EFFECT_TICKS }]);
  });
  it('turns damage into a hit flash, a jam into a label, a revive into a pulse, and ignores the rest', () => {
    const events: BattleEvent[] = [
      { kind: 'damage', soldierId: 3, amount: 8, weapon: 'gunner' },
      { kind: 'jam', soldierId: 0 },
      { kind: 'revived', soldierId: 4 },
      { kind: 'shot', soldierId: 1, weapon: 'launcher' },
      { kind: 'downed', soldierId: 3 },
      { kind: 'victory', winner: 'blue' },
    ];
    const fx = effectsFromEvents(events, 5);
    expect(fx.map((f) => f.kind)).toEqual(['hit', 'jam', 'revive', 'muzzle']);
    expect(fx[0]).toMatchObject({ soldierId: 3, until: 5 + HIT_FLASH_TICKS });
    expect(fx[1]).toMatchObject({ soldierId: 0, until: 5 + JAM_LABEL_TICKS });
  });
});

describe('pruneEffects', () => {
  it('drops effects whose until has passed and keeps the rest in order', () => {
    const fx = effectsFromEvents([{ kind: 'impact', x: 0, y: 0, weapon: 'chucker', radius: 48 }, { kind: 'jam', soldierId: 0 }], 0);
    expect(pruneEffects(fx, IMPACT_EFFECT_TICKS - 1)).toHaveLength(2);
    const later = pruneEffects(fx, IMPACT_EFFECT_TICKS);
    expect(later).toHaveLength(1);
    expect(later[0].kind).toBe('jam');
    expect(pruneEffects(fx, JAM_LABEL_TICKS)).toEqual([]);
  });
});
