/* hhl-exp v1 — GENERATED from src/experiences by scripts/experiences/generate-player-asset.ts. Do not edit by hand. */
(function () {
'use strict';
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
/** Flatten acts into an ordered step list, tagging each step with its act context. */
function flatten(scenario) {
    const steps = [];
    for (const act of scenario.acts || []) {
        for (const step of act.steps || []) {
            steps.push({ ...step, actId: act.id, actTitle: act.title });
        }
    }
    return steps;
}
function createPlayerCore(scenario) {
    const steps = flatten(scenario);
    const total = steps.length;
    let status = 'idle';
    let index = 0;
    let showCTA = false;
    const clamp = (i) => Math.max(0, Math.min(total - 1, i));
    function getViewState() {
        var _a;
        return {
            status,
            index,
            total,
            step: status === 'playing' ? (_a = steps[index]) !== null && _a !== void 0 ? _a : null : null,
            showCTA,
        };
    }
    function dispatch(event) {
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
                }
                else if (status === 'playing') {
                    if (index < total - 1) {
                        index += 1;
                    }
                    else {
                        status = 'arcComplete';
                        showCTA = true;
                    }
                }
                // 'arcComplete'/'idle'/'error' ignore advance.
                break;
            case 'back':
                if (status === 'playing') {
                    index = clamp(index - 1);
                }
                else if (status === 'arcComplete') {
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
    function resolveOutput(step) {
        var _a, _b;
        // v1: static output resolved synchronously. Async signature is the Slice 2 seam
        // for a future mode:"live" data source; the state machine is unchanged either way.
        const output = step.output;
        return Promise.resolve({
            text: (_a = output === null || output === void 0 ? void 0 : output.text) !== null && _a !== void 0 ? _a : '',
            format: (_b = output === null || output === void 0 ? void 0 : output.format) !== null && _b !== void 0 ? _b : 'text',
        });
    }
    return { getViewState, dispatch, resolveOutput };
}

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
function flattenSteps(scenario) {
    const out = [];
    for (const act of scenario.acts || []) {
        for (const step of act.steps || [])
            out.push({ ...step, actId: act.id, actTitle: act.title });
    }
    return out;
}
function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs)
        for (const k in attrs)
            node.setAttribute(k, attrs[k]);
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function mountExperiencePlayer(root) {
    // Kill switch (flag half). Render nothing when disabled.
    if (root.getAttribute('data-flag-enabled') !== 'true')
        return;
    const islandId = root.getAttribute('data-scenario-el');
    const island = islandId ? document.getElementById(islandId) : null;
    if (!island || !island.textContent)
        return;
    let scenario;
    try {
        scenario = JSON.parse(island.textContent);
    }
    catch {
        return;
    }
    const steps = flattenSteps(scenario);
    const total = steps.length;
    const reduced = typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // ---- CTA config (retargetable via data-* attributes) ----
    const ctaPrimary = {
        label: root.getAttribute('data-cta-primary-label') || 'Launch the full Virtual Lab',
        url: root.getAttribute('data-cta-primary-url') || '#',
    };
    let ctaSecondary = [];
    try {
        ctaSecondary = JSON.parse(root.getAttribute('data-cta-secondary-json') || '[]');
    }
    catch {
        ctaSecondary = [];
    }
    // ---- DOM scaffold ----
    const section = el('section', { class: 'hhl-exp', 'aria-labelledby': 'hhl-exp-title' });
    section.appendChild(el('h1', { id: 'hhl-exp-title', class: 'hhl-exp__title' }, scenario.title || 'Guided replay'));
    section.appendChild(el('p', { class: 'hhl-exp__honesty', 'data-testid': 'honesty-label' }, scenario.honestyLabel || ''));
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
    stage.appendChild(narrative);
    stage.appendChild(terminal);
    stage.appendChild(topology);
    const controls = el('nav', { class: 'hhl-exp__controls', 'aria-label': 'Replay controls' });
    const btnRestart = el('button', { type: 'button', 'data-act': 'restart' }, 'Restart');
    const btnPrev = el('button', { type: 'button', 'data-act': 'prev' }, 'Previous');
    const btnNext = el('button', { type: 'button', 'data-act': 'next' }, 'Next');
    const btnSkip = el('button', { type: 'button', 'data-act': 'skip' }, 'Skip to end');
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
    root.appendChild(section);
    // ---- Core + rendering ----
    const core = createPlayerCore(scenario);
    let renderedCount = 0; // number of steps appended to the terminal
    function appendStep(step) {
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
    function revealUpTo(index) {
        while (renderedCount <= index && renderedCount < total) {
            appendStep(steps[renderedCount]);
            renderedCount += 1;
        }
    }
    function sync(focusTarget) {
        const vs = core.getViewState();
        if (vs.status === 'playing') {
            revealUpTo(vs.index);
            const step = steps[vs.index];
            stepTitle.textContent = step.actTitle ? `${step.actTitle}: ${step.narrative || step.id}` : step.narrative || step.id;
            stepBody.textContent = step.narrative || '';
            progress.textContent = `Step ${vs.index + 1} of ${total}`;
            cta.setAttribute('hidden', '');
            if (focusTarget === 'step')
                stepTitle.focus();
        }
        else if (vs.status === 'arcComplete') {
            revealUpTo(total - 1);
            progress.textContent = `Replay complete`;
            cta.removeAttribute('hidden');
            if (focusTarget === 'cta')
                ctaHeading.focus();
        }
    }
    function next(focus = 'step') {
        core.dispatch({ type: 'advance' });
        const done = core.getViewState().status === 'arcComplete';
        sync(done ? 'cta' : focus);
    }
    function prev() {
        core.dispatch({ type: 'back' });
        sync('step');
    }
    function restart() {
        core.dispatch({ type: 'restart' });
        terminal.innerHTML = '';
        renderedCount = 0;
        core.dispatch({ type: 'advance' }); // re-reveal step 0
        sync('step');
    }
    function skipToEnd() {
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
    section.addEventListener('keydown', (ev) => {
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

/**
 * experience-player.entry — browser bootstrap for the Slice 1 Fabric Operator replay.
 *
 * Bundled (with player-core + player-view) into the shipped IIFE asset
 * clean-x-hedgehog-templates/assets/js/experience-player.js by
 * scripts/experiences/generate-player-asset.ts. Not loaded in Node.
 */
function boot() {
    const roots = document.querySelectorAll('[data-hhl-experience]');
    roots.forEach((node) => mountExperiencePlayer(node));
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
}
else {
    boot();
}

})();
