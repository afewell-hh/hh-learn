/**
 * RED (Phase 4, #485) — replay player pure state machine (#483 spec).
 *
 * The DOM-free core is authored in TypeScript so it is unit-testable under ts-jest
 * (the browser asset is a thin view generated from it — see the RED plan on #485,
 * "test-architecture decisions", for the layout refinement flagged to devb).
 *
 * Contract under test:
 *   createPlayerCore(scenario) => {
 *     getViewState(): { status, index, total, step, showCTA },
 *     dispatch(event: { type: 'init'|'advance'|'back'|'jumpTo'|'restart'|'flagDisabled', index?: number }): void,
 *     resolveOutput(step): Promise<{ text: string, format: string }>   // async seam for Slice 2 'live'
 *   }
 *   status ∈ 'idle'|'loading'|'ready'|'playing'|'arcComplete'|'error'
 *   advance is MANUAL (no timers in core); timingMs is view-only.
 *
 * FAILS TODAY: src/experiences/player-core.ts does not exist yet (RED).
 */
import * as fs from 'fs';
import * as path from 'path';
import { createPlayerCore } from '../../src/experiences/player-core';

const FIX = path.resolve(__dirname, '../fixtures/experiences');
function loadValid(): any {
  return JSON.parse(fs.readFileSync(path.join(FIX, 'scenario.valid.json'), 'utf8'));
}
// A 3-step scenario for progression assertions.
function threeSteps(): any {
  const s = loadValid();
  const mk = (id: string) => ({ id, kind: 'narrative', narrative: id });
  s.acts[0].steps = [mk('s1'), mk('s2'), mk('s3')];
  return s;
}

describe('player-core — lifecycle', () => {
  it('starts idle, becomes ready after init, renders nothing yet', () => {
    const core = createPlayerCore(loadValid());
    expect(core.getViewState().status).toBe('idle');
    core.dispatch({ type: 'init' });
    const vs = core.getViewState();
    expect(vs.status).toBe('ready');
    expect(vs.index).toBe(0);
  });

  it('flagDisabled forces idle and renders nothing', () => {
    const core = createPlayerCore(loadValid());
    core.dispatch({ type: 'init' });
    core.dispatch({ type: 'flagDisabled' });
    expect(core.getViewState().status).toBe('idle');
  });
});

describe('player-core — manual progression', () => {
  it('advances one step per advance and clamps at bounds', () => {
    const core = createPlayerCore(threeSteps());
    core.dispatch({ type: 'init' });
    core.dispatch({ type: 'advance' }); // -> playing step0
    expect(core.getViewState().index).toBe(0);
    core.dispatch({ type: 'advance' });
    expect(core.getViewState().index).toBe(1);
    core.dispatch({ type: 'back' });
    expect(core.getViewState().index).toBe(0);
    core.dispatch({ type: 'back' }); // clamp at 0
    expect(core.getViewState().index).toBe(0);
  });

  it('reaches arcComplete after the last step and reveals the CTA', () => {
    const core = createPlayerCore(threeSteps());
    core.dispatch({ type: 'init' });
    for (let i = 0; i < 5; i++) core.dispatch({ type: 'advance' }); // over-advance past 3 steps
    const vs = core.getViewState();
    expect(vs.status).toBe('arcComplete');
    expect(vs.showCTA).toBe(true);
  });

  it('restart returns to ready at index 0 with CTA hidden', () => {
    const core = createPlayerCore(threeSteps());
    core.dispatch({ type: 'init' });
    for (let i = 0; i < 5; i++) core.dispatch({ type: 'advance' });
    core.dispatch({ type: 'restart' });
    const vs = core.getViewState();
    expect(vs.status).toBe('ready');
    expect(vs.index).toBe(0);
    expect(vs.showCTA).toBe(false);
  });
});

describe('player-core — async output seam (Slice 2 compatibility)', () => {
  it('resolveOutput returns a Promise resolving to the static output in v1', async () => {
    const core = createPlayerCore(loadValid());
    const step = loadValid().acts[0].steps[0];
    await expect(core.resolveOutput(step)).resolves.toEqual({
      text: 'vpc.vpc.githedgehog.com/webapp-prod created',
      format: 'text',
    });
  });
});
