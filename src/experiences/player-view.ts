/**
 * player-view — thin DOM view for the Slice 1 Fabric Operator replay (Epic #478 / #483).
 *
 * Framework-free, CSP-safe. Consumes the shared pure state machine (`createPlayerCore`)
 * so the browser view is NOT a divergent reimplementation — the same core is unit-tested
 * under ts-jest and bundled into the shipped asset by scripts/experiences/generate-player-asset.ts.
 *
 * Accessibility (see #483): terminal is role=log aria-live=polite with WHOLE-LINE inserts
 * (no per-character noise); typing effect is visual-only and disabled under reduced motion;
 * focus moves to the current step title on advance and to the CTA at arc end.
 */
import { createPlayerCore, Scenario, Step } from './player-core';

interface CtaLink {
  label: string;
  url: string;
}

function flattenSteps(scenario: Scenario): Step[] {
  const out: Step[] = [];
  for (const act of scenario.acts || []) {
    for (const step of act.steps || []) out.push({ ...step, actId: act.id, actTitle: act.title });
  }
  return out;
}

function el(tag: string, attrs?: Record<string, string>, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Render the fabric entities as labelled chips (real ids: leaf-01, E1/1, server-01, VPCs). */
function renderTopology(container: HTMLElement, scenario: Scenario): void {
  const entities = (scenario as any).entities || {};
  const group = (label: string, items: HTMLElement[]): HTMLElement | null => {
    if (!items.length) return null;
    const wrap = el('div', { class: 'hhl-exp__topo-group' });
    wrap.appendChild(el('span', { class: 'hhl-exp__topo-label' }, label));
    items.forEach((i) => wrap.appendChild(i));
    return wrap;
  };
  const chip = (id: string, sub?: string): HTMLElement => {
    const c = el('span', { class: 'hhl-exp__topo-chip', 'data-entity': id }, id);
    if (sub) c.appendChild(el('span', { class: 'hhl-exp__topo-sub' }, ` ${sub}`));
    return c;
  };
  const switches = (entities.switches || []).map((s: any) =>
    chip(s.id, (s.ports || []).length ? (s.ports as string[]).join(', ') : s.role),
  );
  const servers = (entities.servers || []).map((s: any) => chip(s.id));
  const vpcs = (entities.vpcs || []).map((v: any) =>
    chip(v.id, (v.vlans || []).length ? `VLAN ${(v.vlans as number[]).join('/')}` : ''),
  );
  [group('Switches', switches), group('Servers', servers), group('VPCs', vpcs)].forEach((g) => {
    if (g) container.appendChild(g);
  });
}

export function mountExperiencePlayer(root: HTMLElement): void {
  // Kill switch (flag half). Render nothing when disabled.
  if (root.getAttribute('data-flag-enabled') !== 'true') return;

  const islandId = root.getAttribute('data-scenario-el');
  const island = islandId ? document.getElementById(islandId) : null;
  if (!island || !island.textContent) return;

  let scenario: Scenario;
  try {
    scenario = JSON.parse(island.textContent) as Scenario;
  } catch {
    return;
  }

  const steps = flattenSteps(scenario);
  const total = steps.length;
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- CTA config (retargetable via data-* attributes) ----
  const ctaPrimary: CtaLink = {
    label: root.getAttribute('data-cta-primary-label') || 'Launch the full Virtual Lab',
    url: root.getAttribute('data-cta-primary-url') || '#',
  };
  let ctaSecondary: CtaLink[] = [];
  try {
    ctaSecondary = JSON.parse(root.getAttribute('data-cta-secondary-json') || '[]');
  } catch {
    ctaSecondary = [];
  }

  // ---- DOM scaffold ----
  const section = el('section', { class: 'hhl-exp', 'aria-labelledby': 'hhl-exp-title' });
  section.appendChild(el('h1', { id: 'hhl-exp-title', class: 'hhl-exp__title' }, scenario.title || 'Guided replay'));
  section.appendChild(
    el('p', { class: 'hhl-exp__honesty', 'data-testid': 'honesty-label' }, (scenario as any).honestyLabel || ''),
  );

  const stage = el('div', { class: 'hhl-exp__stage' });

  const narrative = el('div', { class: 'hhl-exp__narrative' });
  const stepTitle = el('h2', { 'data-testid': 'step-title', class: 'hhl-exp__step-title', tabindex: '-1' }, '');
  const stepBody = el('p', { class: 'hhl-exp__step-body' }, '');
  narrative.appendChild(stepTitle);
  narrative.appendChild(stepBody);

  const terminal = el('div', {
    class: 'hhl-exp__terminal' + (reduced ? '' : ' is-typing'),
    role: 'log',
    'aria-live': 'polite',
    'aria-atomic': 'false',
    'aria-label': 'Terminal output',
  });

  const topology = el('div', {
    class: 'hhl-exp__topology',
    role: 'img',
    'aria-label': 'Fabric topology',
  });
  renderTopology(topology, scenario);

  stage.appendChild(narrative);
  stage.appendChild(terminal);
  stage.appendChild(topology);

  const controls = el('nav', { class: 'hhl-exp__controls', 'aria-label': 'Replay controls' });
  const btnRestart = el('button', { type: 'button', 'data-act': 'restart' }, 'Restart') as HTMLButtonElement;
  const btnPrev = el('button', { type: 'button', 'data-act': 'prev' }, 'Previous') as HTMLButtonElement;
  const btnNext = el('button', { type: 'button', 'data-act': 'next' }, 'Next') as HTMLButtonElement;
  const btnSkip = el('button', { type: 'button', 'data-act': 'skip' }, 'Skip to end') as HTMLButtonElement;
  const progress = el('span', { class: 'hhl-exp__progress', role: 'status', 'aria-live': 'polite' }, '');
  controls.append(btnRestart, btnPrev, btnNext, btnSkip, progress);

  const cta = el('div', { class: 'hhl-exp__cta', 'data-testid': 'lead-bridge', hidden: '' });
  const ctaHeading = el('h2', { class: 'hhl-exp__cta-title', tabindex: '-1' }, 'Ready to go hands-on?');
  cta.appendChild(ctaHeading);
  const primaryLink = el('a', { class: 'hhl-exp__cta-primary', href: ctaPrimary.url, rel: 'noopener' }, ctaPrimary.label);
  cta.appendChild(primaryLink);
  for (const s of ctaSecondary) {
    cta.appendChild(el('a', { class: 'hhl-exp__cta-secondary', href: s.url, rel: 'noopener' }, s.label));
  }

  section.append(stage, controls, cta);
  // Clear any static no-JS fallback the template rendered inside the mount before
  // the player takes over (finding #5). The scenario island is a separate element.
  root.textContent = '';
  root.appendChild(section);

  function updateTopology(step: Step): void {
    const highlights: string[] = [];
    for (const ann of step.annotations || []) {
      const m = /^(?:highlight|pulse|link):(.+)$/.exec(ann);
      if (m) highlights.push(m[1]);
    }
    const chips = topology.querySelectorAll('[data-entity]');
    chips.forEach((c) => {
      const id = c.getAttribute('data-entity') || '';
      if (highlights.indexOf(id) !== -1) c.classList.add('is-highlighted');
      else c.classList.remove('is-highlighted');
    });
    topology.setAttribute(
      'aria-label',
      highlights.length ? `Fabric topology; highlighting ${highlights.join(', ')}` : 'Fabric topology',
    );
  }

  // ---- Core + rendering ----
  const core = createPlayerCore(scenario);
  let renderedCount = 0; // number of steps appended to the terminal

  function appendStep(step: Step): void {
    const line = el('div', { class: 'hhl-exp__line' });
    if (step.command) {
      line.appendChild(el('span', { class: 'hhl-visually-hidden' }, 'command: '));
      line.appendChild(el('span', { class: 'hhl-exp__prompt' }, '$ '));
      line.appendChild(el('span', { class: 'hhl-exp__cmd' }, step.command));
    }
    if (step.output && step.output.text) {
      line.appendChild(el('span', { class: 'hhl-visually-hidden' }, 'output: '));
      line.appendChild(el('pre', { class: 'hhl-exp__out' }, step.output.text));
    }
    terminal.appendChild(line);
  }

  function revealUpTo(index: number): void {
    while (renderedCount <= index && renderedCount < total) {
      appendStep(steps[renderedCount]);
      renderedCount += 1;
    }
  }

  function sync(focusTarget: 'step' | 'cta' | 'none'): void {
    const vs = core.getViewState();
    if (vs.status === 'playing') {
      revealUpTo(vs.index);
      const step = steps[vs.index];
      stepTitle.textContent = step.actTitle ? `${step.actTitle}: ${step.narrative || step.id}` : step.narrative || step.id;
      stepBody.textContent = step.narrative || '';
      progress.textContent = `Step ${vs.index + 1} of ${total}`;
      updateTopology(step);
      cta.setAttribute('hidden', '');
      if (focusTarget === 'step') stepTitle.focus();
    } else if (vs.status === 'arcComplete') {
      revealUpTo(total - 1);
      progress.textContent = `Replay complete`;
      cta.removeAttribute('hidden');
      if (focusTarget === 'cta') ctaHeading.focus();
    }
  }

  function next(focus: 'step' | 'cta' | 'none' = 'step'): void {
    core.dispatch({ type: 'advance' });
    const done = core.getViewState().status === 'arcComplete';
    sync(done ? 'cta' : focus);
  }
  function prev(): void {
    core.dispatch({ type: 'back' });
    sync('step');
  }
  function restart(): void {
    core.dispatch({ type: 'restart' });
    terminal.innerHTML = '';
    renderedCount = 0;
    core.dispatch({ type: 'advance' }); // re-reveal step 0
    sync('step');
  }
  function skipToEnd(): void {
    let guard = 0;
    while (core.getViewState().status !== 'arcComplete' && guard <= total + 1) {
      core.dispatch({ type: 'advance' });
      guard += 1;
    }
    sync('cta');
  }

  btnNext.addEventListener('click', () => next('step'));
  btnPrev.addEventListener('click', () => prev());
  btnRestart.addEventListener('click', () => restart());
  btnSkip.addEventListener('click', () => skipToEnd());

  section.addEventListener('keydown', (ev: KeyboardEvent) => {
    switch (ev.key) {
      case 'ArrowRight':
      case 'Enter':
        ev.preventDefault();
        next('step');
        break;
      case 'ArrowLeft':
        ev.preventDefault();
        prev();
        break;
      case 'Home':
        ev.preventDefault();
        restart();
        break;
      case 'End':
        ev.preventDefault();
        skipToEnd();
        break;
      case ' ':
        ev.preventDefault();
        next('step');
        break;
    }
  });

  // Bootstrap: init and auto-reveal the first step so the visitor immediately sees
  // real content (no click required). Does not steal focus on initial load.
  core.dispatch({ type: 'init' });
  core.dispatch({ type: 'advance' });
  sync('none');
}
