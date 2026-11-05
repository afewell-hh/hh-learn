/**
 * player-core — DOM-free state machine for the Slice 1 Fabric Operator guided replay
 * (Epic #478 / #483). Authored in TypeScript so it is deterministically unit-testable
 * under ts-jest; the browser asset (`experience-player.js`) is a thin view generated
 * from this core (see scripts/experiences/generate-player-asset.ts).
 *
 * Design rules (from #483):
 *  - Manual advance only; NO timers in the core. `timingMs` is a view-only hint.
 *  - `resolveOutput(step)` is async — the Slice 2 seam. In v1 it resolves the static
 *    output synchronously; a future `mode:"live"` fetch slots in without a state change.
 */

export type StepKind = 'command' | 'observe' | 'narrative';

export interface StepOutput {
  mode: 'static' | 'live';
  text?: string;
  format?: string;
}

export interface Step {
  id: string;
  kind: StepKind;
  narrative?: string;
  command?: string;
  output?: StepOutput;
  annotations?: string[];
  timingMs?: number;
  actId?: string;
  actTitle?: string;
}

export interface Act {
  id: string;
  title?: string;
  primaryEntities?: string[];
  steps: Step[];
}

export interface Scenario {
  scenarioId: string;
  version: string;
  title?: string;
  acts: Act[];
  [key: string]: unknown;
}

export type Status = 'idle' | 'loading' | 'ready' | 'playing' | 'arcComplete' | 'error';

export interface ViewState {
  status: Status;
  index: number;
  total: number;
  step: Step | null;
  showCTA: boolean;
}

export type PlayerEvent =
  | { type: 'init' }
  | { type: 'advance' }
  | { type: 'back' }
  | { type: 'jumpTo'; index: number }
  | { type: 'restart' }
  | { type: 'flagDisabled' };

export interface PlayerCore {
  getViewState(): ViewState;
  dispatch(event: PlayerEvent): void;
  resolveOutput(step: Step): Promise<{ text: string; format: string }>;
}

/** Flatten acts into an ordered step list, tagging each step with its act context. */
function flatten(scenario: Scenario): Step[] {
  const steps: Step[] = [];
  for (const act of scenario.acts || []) {
    for (const step of act.steps || []) {
      steps.push({ ...step, actId: act.id, actTitle: act.title });
    }
  }
  return steps;
}

export function createPlayerCore(scenario: Scenario): PlayerCore {
  const steps = flatten(scenario);
  const total = steps.length;

  let status: Status = 'idle';
  let index = 0;
  let showCTA = false;

  const clamp = (i: number) => Math.max(0, Math.min(total - 1, i));

  function getViewState(): ViewState {
    return {
      status,
      index,
      total,
      step: status === 'playing' ? steps[index] ?? null : null,
      showCTA,
    };
  }

  function dispatch(event: PlayerEvent): void {
    switch (event.type) {
      case 'init':
        if (status === 'idle') {
          status = 'ready';
          index = 0;
          showCTA = false;
        }
        break;

      case 'advance':
        if (status === 'ready') {
          // First advance reveals the first step.
          status = total > 0 ? 'playing' : 'arcComplete';
          index = 0;
          showCTA = status === 'arcComplete';
        } else if (status === 'playing') {
          if (index < total - 1) {
            index += 1;
          } else {
            status = 'arcComplete';
            showCTA = true;
          }
        }
        // 'arcComplete'/'idle'/'error' ignore advance.
        break;

      case 'back':
        if (status === 'playing') {
          index = clamp(index - 1);
        } else if (status === 'arcComplete') {
          // Step back into the last rendered step.
          status = 'playing';
          index = clamp(total - 1);
          showCTA = false;
        }
        break;

      case 'jumpTo':
        if (status === 'ready' || status === 'playing' || status === 'arcComplete') {
          if (total > 0) {
            status = 'playing';
            index = clamp(event.index);
            showCTA = false;
          }
        }
        break;

      case 'restart':
        status = 'ready';
        index = 0;
        showCTA = false;
        break;

      case 'flagDisabled':
        // Kill switch: render nothing.
        status = 'idle';
        index = 0;
        showCTA = false;
        break;
    }
  }

  function resolveOutput(step: Step): Promise<{ text: string; format: string }> {
    // v1: static output resolved synchronously. Async signature is the Slice 2 seam
    // for a future mode:"live" data source; the state machine is unchanged either way.
    const output = step.output;
    return Promise.resolve({
      text: output?.text ?? '',
      format: output?.format ?? 'text',
    });
  }

  return { getViewState, dispatch, resolveOutput };
}
