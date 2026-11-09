/*
 * compare.js — renderer for the `compare` interactive primitive ("old way vs Hedgehog way").
 * Design: docs/authoring-platform.md section 3.7 (rules) and 3.6 (look and feel).
 *
 * One file, two consumers:
 *   - the browser mounts it on every [data-hh-compare] element;
 *   - scripts/validate-authoring.mjs and the unit tests `require` it for `checkCompare`,
 *     `analyse` and `weakestLabel`, so the validator and the renderer cannot disagree about
 *     how a count is derived or whether a pane is honestly labelled.
 *
 * No network: this file makes no request of any kind and creates no script, image or link element.
 * Everything it renders comes from the JSON payload inlined by the HubL include (per #480
 * experience routes use HubSpot-native analytics only). The only event it emits is a local
 * DOM CustomEvent.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.HHCompare = api;
    api.autoMount(root.document);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Derivation and integrity rules (shared with the validator)
  // ---------------------------------------------------------------------------

  var MARKER_START_RE = /^\s*(?:#|!)\s*@device/;
  var MARKER_RE = /^\s*(?:#|!)\s*@device\s+([A-Za-z0-9][A-Za-z0-9._-]{0,62})\s*$/;
  var COMMENT_RE = /^\s*(#|!|\/\/)/;
  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var HEREDOC_RE = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/;
  var BLOCK_SCALAR_RE = /(?::|^\s*-)\s*[|>][+-]?\d*\s*$/;
  var PLACEHOLDER_RE = /^(?:tbd|tba|todo|fixme|n\/?a|none|null|undefined|unknown|nil|x+|\?+|\.+|-+|_+|placeholder|changeme|test|testing|sample|example|foo|bar|baz|asdf+|lorem(?: ipsum)?)\.?$/i;
  var PLACEHOLDER_IN_TEXT_RE = /\b(?:lorem ipsum|tbd|todo|fixme|changeme)\b|\bx{3,}\b/i;

  function splitLines(text) {
    var lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  /** Advance an open-quote state across one line. Returns the quote char still open at end of line, or null. */
  function scanQuotes(line, q) {
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (q) {
        if (ch === '\\' && q === '"') i++;
        else if (ch === q) q = null;
      } else {
        if (ch === '#' && (i === 0 || /\s/.test(line.charAt(i - 1)))) break;
        if ((ch === '"' || ch === "'") && (i === 0 || /[\s=:(,[{]/.test(line.charAt(i - 1)))) q = ch;
      }
    }
    return q;
  }

  function indentOf(l) { return l.match(/^\s*/)[0].length; }

  /**
   * The only place a count is computed. A "line" is a non-blank, non-comment line
   * (comments start with #, ! or //). A device is a `# @device <name>` marker whose section holds
   * at least one real configuration line: a marker with nothing under it is not a device and is
   * reported in `emptyDevices`. Marker-looking lines inside a heredoc, a multi-line quoted string or a
   * YAML block scalar are content, not markers, and are reported in `ambiguousMarkers` (an error).
   * Malformed markers (no name, trailing text, bad characters) are reported in `malformedMarkers`.
   */
  function analyse(text) {
    var raw = splitLines(text);
    var order = [];
    var duplicates = [];
    var perDevice = {};
    var current = null;
    var content = 0;
    var orphan = 0;
    var fixture = false;
    var malformed = [];
    var ambiguous = [];
    var heredoc = null;   // { tag, dash }
    var quote = null;
    var block = null;     // indent of the key that opened a block scalar
    var kinds = raw.map(function (l, i) {
      var looksLikeMarker = MARKER_START_RE.test(l);
      var inContext = !!(heredoc || quote || block !== null);
      if (heredoc) {
        if ((heredoc.dash ? l.trim() : l) === heredoc.tag) heredoc = null;
      } else if (quote) {
        quote = scanQuotes(l, quote);
      } else if (block !== null) {
        if (!l.trim()) return 'blank';
        if (indentOf(l) <= block) { block = null; inContext = false; }
      }
      if (inContext) {
        if (looksLikeMarker) ambiguous.push(i + 1);
        content++;
        if (current) perDevice[current].lines++; else orphan++;
        return 'code';
      }
      if (looksLikeMarker) {
        var m = l.match(MARKER_RE);
        if (!m) { malformed.push({ line: i + 1, text: l.trim() }); return 'comment'; }
        if (perDevice[m[1]]) duplicates.push(m[1]);
        else { order.push(m[1]); perDevice[m[1]] = { start: i + 1, lines: 0 }; }
        current = m[1];
        return 'device';
      }
      if (/^\s*(?:#|!|\/\/)\s*@fixture\b/.test(l)) fixture = true;
      if (!l.trim()) return 'blank';
      if (COMMENT_RE.test(l)) return 'comment';
      content++;
      if (current) perDevice[current].lines++; else orphan++;
      var h = l.match(HEREDOC_RE);
      if (h) heredoc = { tag: h[3], dash: h[1] === '-' };
      else if (BLOCK_SCALAR_RE.test(l)) block = indentOf(l);
      else quote = scanQuotes(l, null);
      return 'code';
    });
    var devices = order.filter(function (d) { return perDevice[d].lines > 0; });
    var emptyDevices = order.filter(function (d) { return perDevice[d].lines === 0; });
    return {
      raw: raw, kinds: kinds, total: raw.length, lines: content,
      devices: devices, emptyDevices: emptyDevices, duplicateDevices: duplicates, perDevice: perDevice,
      malformedMarkers: malformed, ambiguousMarkers: ambiguous,
      unterminated: !!(heredoc || quote), orphanLines: order.length ? orphan : 0,
      fixture: fixture
    };
  }

  /**
   * Returns null when `v` is a meaningful trimmed string, otherwise the reason it is not.
   * Rejects whitespace, non-strings, too-short text and obvious placeholders.
   */
  function plainTextProblem(v, minChars, minWords, maxChars) {
    if (typeof v !== 'string') return 'must be a string';
    var t = v.trim();
    if (!t) return 'is empty or whitespace';
    if (!/[A-Za-z0-9]/.test(t)) return 'has no letters or digits';
    if (PLACEHOLDER_RE.test(t) || PLACEHOLDER_IN_TEXT_RE.test(t)) return 'looks like a placeholder ("' + t.slice(0, 30) + '")';
    if (t.length < (minChars || 1)) return 'is too short (need at least ' + minChars + ' characters)';
    if (minWords && t.split(/\s+/).length < minWords) return 'is too short (need at least ' + minWords + ' words)';
    if (maxChars && t.length > maxChars) return 'is too long (at most ' + maxChars + ' characters)';
    return null;
  }

  /** The primitive's own label is the weaker of the two sides: anything not captured is "illustrative". */
  function weakestLabel(left, right) {
    return left && right && left.provenance === 'captured' && right.provenance === 'captured' ? 'captured' : 'illustrative';
  }

  function realDate(s) {
    var m = typeof s === 'string' && s.match(DATE_RE);
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }

  /**
   * Every integrity rule of section 3.7 that can be decided from the declaration plus the two source
   * texts. Returns [{level:'error'|'warn', code, message}]. The renderer refuses to draw panes when any
   * error is present, so a page cannot show a comparison the validator would reject.
   * `now` is injectable for tests.
   */
  function checkCompare(it, texts, now) {
    var out = [];
    var err = function (code, message) { out.push({ level: 'error', code: code, message: message }); };
    var warn = function (code, message) { out.push({ level: 'warn', code: code, message: message }); };
    texts = texts || {};
    var today = now ? new Date(now) : new Date();

    if (!it || typeof it !== 'object') { err('COMPARE_SHAPE', 'compare declaration missing'); return out; }
    if ('counts' in it) err('COMPARE_COUNTS_AUTHORED', 'counts are derived from the source files by the renderer and validator; remove the authored "counts" so they cannot be inflated');
    if (it.evidence_plane === 'data-plane') err('COMPARE_PLANE', 'configuration is control-plane evidence and cannot be presented as data-plane proof; evidence_plane must be "control-plane" (or "none")');
    else if (['control-plane', 'none'].indexOf(it.evidence_plane) < 0) err('EVIDENCE_PLANE', 'evidence_plane must be "control-plane" or "none" (control-plane evidence is not data-plane evidence)');
    if (it.claims_data_plane === true) err('PLANE_OVERCLAIM', 'claims data-plane behaviour, but a compare shows configuration, which is control-plane evidence only');
    if (['captured', 'illustrative'].indexOf(it.source_label) < 0) err('HONESTY_LABEL', 'source_label must be "captured" or "illustrative" for a compare');
    else if (it.left && it.right && it.source_label !== weakestLabel(it.left, it.right)) {
      err('HONESTY_MISMATCH', 'compare is labelled by its weakest side; with sides ' + it.left.provenance + '/' + it.right.provenance + ' the label must be "' + weakestLabel(it.left, it.right) + '"');
    }
    if (it.steps !== undefined && !Array.isArray(it.steps)) err('COMPARE_STEPS', 'steps must be an array of { title, left: [first, last], right: [first, last] }');

    var sides = {};
    ['left', 'right'].forEach(function (name) {
      var side = it[name];
      var w = name + ' side';
      if (!side || typeof side !== 'object') { err('COMPARE_SIDE', w + ' missing'); return; }
      if ('counts' in side) err('COMPARE_COUNTS_AUTHORED', w + ': counts are derived, never authored');
      if (['old_way', 'hedgehog_way', 'other'].indexOf(side.role) < 0) err('COMPARE_ROLE', w + ': role must be old_way | hedgehog_way | other');
      if (typeof side.label !== 'string' || !side.label.trim()) err('COMPARE_LABEL', w + ': label required');
      if (['captured', 'illustrative'].indexOf(side.provenance) < 0) err('COMPARE_PROVENANCE', w + ': provenance must be "captured" or "illustrative"');
      if (side.provenance === 'captured') {
        var cf = side.captured_from;
        if (!cf || typeof cf !== 'object' || Array.isArray(cf)) {
          err('COMPARE_CAPTURED_FROM', w + ': captured_from { system, version, date } required (which system and version, on what date)');
          cf = {};
        } else {
          var sp = plainTextProblem(cf.system, 2, 0, 80);
          if (sp) err('COMPARE_CAPTURED_FROM', w + ': captured_from.system ' + sp);
          var vp = plainTextProblem(cf.version, 1, 0, 40);
          if (!vp && !/\d/.test(cf.version)) vp = 'must be a version identifier containing a digit';
          if (vp) err('COMPARE_CAPTURED_FROM', w + ': captured_from.version ' + vp);
          if (cf.date === undefined || cf.date === null || cf.date === '') err('COMPARE_CAPTURED_FROM', w + ': captured_from.date required');
        }
        if (cf.date && !realDate(cf.date)) err('COMPARE_DATE', w + ': captured_from.date "' + cf.date + '" is not a real YYYY-MM-DD date');
        else if (cf.date && new Date(cf.date + 'T00:00:00Z') > today) err('COMPARE_DATE', w + ': captured_from.date "' + cf.date + '" is in the future');
        if (side.fixture === true) err('COMPARE_FIXTURE_CAPTURED', w + ': a side marked fixture:true cannot be provenance "captured"; a fixture is not a capture');
      }
      if (side.provenance === 'illustrative') {
        var rp = plainTextProblem(side.illustrative_reason, 10, 3);
        if (rp) err('COMPARE_ILLUSTRATIVE', w + ': an illustrative side needs a real "illustrative_reason" (why it is not captured); it ' + rp);
      }
      if (typeof side.src !== 'string' || !side.src) { err('COMPARE_SRC', w + ': src (path to the captured text) required'); return; }
      if (typeof texts[name] !== 'string') { err('COMPARE_SRC', w + ': source text for "' + side.src + '" was not supplied'); return; }
      sides[name] = side;
    });

    var old = [it.left, it.right].filter(function (s) { return s && s.role === 'old_way'; })[0];
    if (old) {
      var bp = plainTextProblem(old.baseline, 10, 2);
      if (bp) err('COMPARE_BASELINE', 'the old-way side must state its baseline (for example "manual per-device CLI, no automation") so a reader can judge fairness; baseline ' + bp);
      if (['complete', 'excerpt'].indexOf(old.completeness) < 0) err('COMPARE_COMPLETENESS', 'old-way completeness must be "complete" or "excerpt"');
      if (old.completeness === 'excerpt') {
        var op = plainTextProblem(old.omitted, 10, 2);
        if (op) err('COMPARE_OMITTED', 'an excerpted old-way side must say what was omitted; counts will be shown as "excerpt"; omitted ' + op);
      }
      var rbp = plainTextProblem(old.representative_basis, 40, 6);
      if (rbp) err('COMPARE_REPRESENTATIVE', 'old-way side needs "representative_basis" (at least a sentence): why this is how the task is genuinely done, not a straw man; it ' + rbp);
      if (old.provenance === 'illustrative') warn('COMPARE_OLD_ILLUSTRATIVE', 'the old-way side is illustrative; prefer a captured configuration. The pane is labelled illustrative');
    }
    if (it.hard_way === true && (!old || old.provenance !== 'captured' || old.completeness !== 'complete')) {
      err('COMPARE_HARD_WAY', 'hard_way:true requires a captured, complete old-way side. A hard-way campaign that is excerpted or illustrative is a straw man');
    }

    var eq = it.equivalence;
    if (eq && typeof eq === 'object') {
      if (['same', 'differs'].indexOf(eq.status) < 0) err('COMPARE_EQUIVALENCE', 'equivalence.status must be "same" or "differs"');
      var oc = plainTextProblem(eq.outcome, 10, 3);
      if (oc) err('COMPARE_EQUIVALENCE', 'equivalence.outcome (what both sides achieve) ' + oc);
      if (eq.status === 'differs') {
        var df = plainTextProblem(eq.difference, 10, 3);
        if (df) err('COMPARE_DIFFERENCE', 'equivalence.status "differs" requires "difference" (the disclosed gap in outcome); it ' + df);
      }
    } else {
      err('COMPARE_EQUIVALENCE', 'equivalence must be an object { status, outcome, difference? }');
    }

    var derived = {};
    Object.keys(sides).forEach(function (name) {
      var side = sides[name];
      var a = analyse(texts[name]);
      derived[name] = a;
      var w = name + ' side (' + side.src + ')';
      if (a.duplicateDevices.length) err('COMPARE_DEVICES', w + ': duplicate "# @device" markers for ' + a.duplicateDevices.join(', '));
      a.malformedMarkers.forEach(function (m) {
        err('COMPARE_MARKER', w + ': malformed device marker on line ' + m.line + ' ("' + m.text.slice(0, 60) + '"); expected exactly "# @device <name>" with a name of letters, digits, ".", "_" or "-"');
      });
      if (a.ambiguousMarkers.length) err('COMPARE_MARKER', w + ': a "# @device" line appears inside a heredoc, multi-line quote or block scalar (line ' + a.ambiguousMarkers.join(', ') + '); it is content, not a marker, so the device count would be ambiguous');
      if (a.unterminated) err('COMPARE_MARKER', w + ': the source ends inside an unterminated heredoc or quoted string, so device markers cannot be trusted');
      a.emptyDevices.forEach(function (d) {
        err('COMPARE_DEVICE_EMPTY', w + ': device "' + d + '" has a marker but no configuration lines under it; a device only counts if it has real configuration');
      });
      if (a.orphanLines > 0) err('COMPARE_DEVICES', w + ': ' + a.orphanLines + ' configuration line(s) appear before the first "# @device" marker and belong to no device');
      if (Array.isArray(side.devices)) {
        if (side.devices.length > 0 && a.devices.length === 0) {
          err('COMPARE_DEVICES', w + ': declares ' + side.devices.length + ' devices but the source has no "# @device <name>" markers, so the device count cannot be verified');
        } else if (a.devices.length > 0 && (side.devices.length !== a.devices.length || side.devices.some(function (d) { return a.devices.indexOf(d) < 0; }))) {
          err('COMPARE_DEVICES', w + ': devices ' + JSON.stringify(side.devices) + ' do not match the markers in the source (' + a.devices.join(', ') + ')');
        }
      } else if (side.devices !== undefined) {
        err('COMPARE_DEVICES', w + ': devices must be an array of names');
      }
      if (a.lines === 0) err('COMPARE_EMPTY', w + ': contains no configuration lines');
      var fixtureMarked = a.fixture;
      if (side.fixture === true && !fixtureMarked) err('COMPARE_FIXTURE_MARK', w + ': fixture:true requires a "# @fixture" comment line inside the file, so the file itself says it is not a capture');
      if (side.provenance === 'captured' && fixtureMarked) err('COMPARE_FIXTURE_CAPTURED', w + ': the file carries a "# @fixture" marker but the side claims provenance "captured"');
      if (side.fixture !== true && fixtureMarked) err('COMPARE_FIXTURE_MARK', w + ': the file carries a "# @fixture" marker but the side is not declared fixture:true');
      (Array.isArray(it.steps) ? it.steps : []).forEach(function (step, i) {
        var r = step && typeof step === 'object' ? step[name] : undefined;
        if (!Array.isArray(r) || r.length !== 2 || !Number.isInteger(r[0]) || !Number.isInteger(r[1]) || !(r[0] >= 1 && r[1] >= r[0] && r[1] <= a.total)) {
          err('COMPARE_STEP_RANGE', 'steps[' + i + '].' + name + ': expected two integers [firstLine, lastLine] within ' + side.src + ' (' + a.total + ' lines)');
        }
      });
    });
    out.derived = derived;
    return out;
  }

  // ---------------------------------------------------------------------------
  // Renderer
  // ---------------------------------------------------------------------------

  var SEQ = 0;

  function el(doc, tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function provenanceText(side) {
    if (side.fixture === true) return 'Fixture (not a capture)';
    if (side.provenance === 'captured') {
      var cf = side.captured_from;
      return 'Captured · ' + cf.system + ' ' + cf.version + ' · ' + cf.date;
    }
    return 'Illustrative';
  }

  function mount(host, payload, opts) {
    var doc = host.ownerDocument;
    var win = doc.defaultView;
    var reduce = !!(win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var id = 'hh-cmp-' + (++SEQ);
    var it = (payload && payload.interactive) || {};
    var texts = (payload && payload.texts) || {};
    var problems = checkCompare(it, texts, opts && opts.now);
    var errors = problems.filter(function (p) { return p.level === 'error'; });

    host.textContent = '';
    host.classList.add('hh-ix', 'hh-ix-compare');
    host.removeAttribute('data-hh-error');

    if (errors.length) {
      // Fail closed: never draw a comparison the validator would reject.
      host.setAttribute('data-hh-error', 'true');
      var box = el(doc, 'div', 'hh-ix-error');
      box.setAttribute('role', 'alert');
      box.appendChild(el(doc, 'strong', null, 'This comparison cannot be shown.'));
      box.appendChild(el(doc, 'p', null, 'It breaks the rules that keep the comparison honest. An author needs to fix the data; nothing has been drawn that could mislead.'));
      var ul = el(doc, 'ul');
      errors.forEach(function (p) { ul.appendChild(el(doc, 'li', null, p.code + ': ' + p.message)); });
      box.appendChild(ul);
      host.appendChild(box);
      return { ok: false, errors: errors };
    }

    var derived = problems.derived;
    var label = weakestLabel(it.left, it.right);
    var anyFixture = it.left.fixture === true || it.right.fixture === true;
    var steps = Array.isArray(it.steps) ? it.steps : [];
    var visited = {};
    var current = -1;
    var initial = true;

    // Header: honesty pill first, always in the same place.
    var head = el(doc, 'header', 'hh-ix-head');
    var pills = el(doc, 'div', 'hh-ix-pills');
    var pill = el(doc, 'span', 'hh-ix-pill hh-ix-pill--' + label, label === 'captured' ? 'Captured' : 'Illustrative');
    pill.setAttribute('data-hh-label', label);
    pills.appendChild(pill);
    if (anyFixture) pills.appendChild(el(doc, 'span', 'hh-ix-pill hh-ix-pill--fixture', 'Fixture data'));
    pills.appendChild(el(doc, 'span', 'hh-ix-pill hh-ix-pill--plane', it.evidence_plane === 'none' ? 'No plane claim' : 'Control-plane evidence'));
    head.appendChild(pills);
    var title = el(doc, 'h3', 'hh-ix-title', it.title || 'Old way vs Hedgehog way');
    title.id = id + '-title';
    head.appendChild(title);
    if (it.caption) head.appendChild(el(doc, 'p', 'hh-ix-caption', it.caption));
    host.appendChild(head);
    host.setAttribute('role', 'group');
    host.setAttribute('aria-labelledby', title.id);

    if (anyFixture) {
      var fx = el(doc, 'p', 'hh-ix-note hh-ix-note--fixture', 'Fixture: this content was written to exercise the component. It is not configuration captured from a real system and must not be quoted as evidence.');
      host.appendChild(fx);
    }

    // Count strip: derived values only.
    var strip = el(doc, 'div', 'hh-ix-strip');
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Authoring effort, counted from the source files');
    ['left', 'right'].forEach(function (name) {
      var side = it[name], a = derived[name];
      var cell = el(doc, 'dl', 'hh-ix-count');
      cell.setAttribute('data-side', name);
      cell.appendChild(el(doc, 'dt', 'hh-ix-count-name', side.label));
      var l = el(doc, 'dd', 'hh-ix-count-val');
      l.appendChild(el(doc, 'span', 'hh-ix-num', String(a.lines)));
      l.appendChild(el(doc, 'span', 'hh-ix-unit', a.lines === 1 ? ' line written' : ' lines written'));
      if (side.role === 'old_way' && side.completeness === 'excerpt') l.appendChild(el(doc, 'span', 'hh-ix-flag', 'excerpt'));
      cell.appendChild(l);
      var d = el(doc, 'dd', 'hh-ix-count-val hh-ix-count-dev');
      d.appendChild(el(doc, 'span', 'hh-ix-num', String(a.devices.length)));
      d.appendChild(el(doc, 'span', 'hh-ix-unit', a.devices.length === 1 ? ' device configured by hand' : ' devices configured by hand'));
      cell.appendChild(d);
      strip.appendChild(cell);
    });
    strip.appendChild(el(doc, 'p', 'hh-ix-strip-note', 'This measures authoring effort, not device involvement: the lines an operator writes, and the devices they configure by hand (a "# @device" section with real configuration under it). Where the Hedgehog controller generates switch configuration, that is not counted here, so "0 devices configured by hand" does not mean no device is configured. Fewer lines is not a claim about performance, correctness or cost.'));
    host.appendChild(strip);

    // Equivalence statement sits between the strip and the panes.
    var eq = it.equivalence;
    var eqEl = el(doc, 'div', 'hh-ix-equiv hh-ix-equiv--' + eq.status);
    eqEl.appendChild(el(doc, 'strong', 'hh-ix-equiv-tag', eq.status === 'same' ? 'Same outcome' : 'Outcome differs'));
    eqEl.appendChild(el(doc, 'span', null, ' ' + eq.outcome));
    if (eq.status === 'differs') eqEl.appendChild(el(doc, 'p', 'hh-ix-equiv-diff', eq.difference));
    host.appendChild(eqEl);

    // Panes.
    var panes = el(doc, 'div', 'hh-ix-panes');
    var scrollers = {};
    var lineEls = { left: [], right: [] };
    ['left', 'right'].forEach(function (name) {
      var side = it[name], a = derived[name];
      var pane = el(doc, 'section', 'hh-ix-pane');
      pane.setAttribute('data-side', name);
      var ph = el(doc, 'div', 'hh-ix-pane-head');
      var h = el(doc, 'h4', 'hh-ix-pane-title', side.label);
      h.id = id + '-' + name;
      ph.appendChild(h);
      var pp = el(doc, 'span', 'hh-ix-pill hh-ix-pill--' + (side.fixture ? 'fixture' : side.provenance), provenanceText(side));
      ph.appendChild(pp);
      pane.appendChild(ph);
      if (side.provenance === 'illustrative' && side.illustrative_reason) pane.appendChild(el(doc, 'p', 'hh-ix-pane-note', 'Why illustrative: ' + side.illustrative_reason));
      if (side.role === 'old_way') {
        var fair = el(doc, 'details', 'hh-ix-fair');
        fair.appendChild(el(doc, 'summary', null, 'How fair is this side?'));
        var dl = el(doc, 'dl');
        [['Baseline', side.baseline], ['Completeness', side.completeness === 'complete' ? 'Complete' : 'Excerpt'], ['Omitted', side.completeness === 'excerpt' ? side.omitted : null], ['Why representative', side.representative_basis]].forEach(function (kv) {
          if (!kv[1]) return;
          dl.appendChild(el(doc, 'dt', null, kv[0]));
          dl.appendChild(el(doc, 'dd', null, kv[1]));
        });
        fair.appendChild(dl);
        pane.appendChild(fair);
      }
      if (a.devices.length > 1) {
        var nav = el(doc, 'div', 'hh-ix-devs');
        nav.setAttribute('role', 'group');
        nav.setAttribute('aria-label', 'Jump to device');
        a.devices.forEach(function (dev) {
          var b = el(doc, 'button', 'hh-ix-chip', dev);
          b.type = 'button';
          b.addEventListener('click', function () { scrollTo(name, a.perDevice[dev].start); });
          nav.appendChild(b);
        });
        pane.appendChild(nav);
      }
      var pre = el(doc, 'pre', 'hh-ix-code');
      pre.tabIndex = 0;
      pre.setAttribute('role', 'region');
      pre.setAttribute('aria-label', side.label + ', ' + (side.provenance === 'captured' ? 'captured' : 'illustrative') + ' configuration, ' + a.lines + ' lines. Scrollable.');
      a.raw.forEach(function (text, i) {
        var line = el(doc, 'span', 'hh-ix-ln hh-ix-ln--' + a.kinds[i]);
        line.setAttribute('data-n', String(i + 1));
        line.textContent = text.length ? text : ' ';
        pre.appendChild(line);
        lineEls[name].push(line);
      });
      scrollers[name] = pre;
      pane.appendChild(pre);
      panes.appendChild(pane);
    });
    host.appendChild(panes);

    function scrollTo(name, lineNo) {
      var target = lineEls[name][lineNo - 1];
      var pre = scrollers[name];
      if (!target || !pre) return;
      // Measure against the scroller itself. offsetTop is relative to the nearest POSITIONED
      // ancestor, which the <pre> is not, so it yields a page coordinate; scrollTo then clamps
      // to the bottom and the highlighted step is never brought into view. Short files hid this
      // because every line already fitted on screen.
      var top = Math.max(0, target.getBoundingClientRect().top - pre.getBoundingClientRect().top + pre.scrollTop - 8);
      if (typeof pre.scrollTo === 'function') pre.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      else pre.scrollTop = top;
    }

    // Steps.
    var live = el(doc, 'div', 'hh-ix-sr');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    var stepButtons = [];
    var prev, next, status;
    if (steps.length) {
      var rail = el(doc, 'div', 'hh-ix-steps');
      rail.setAttribute('role', 'group');
      rail.setAttribute('aria-label', 'Walkthrough');
      var ctl = el(doc, 'div', 'hh-ix-step-ctl');
      prev = el(doc, 'button', 'hh-ix-btn', 'Previous step');
      next = el(doc, 'button', 'hh-ix-btn hh-ix-btn--primary', 'Next step');
      prev.type = next.type = 'button';
      status = el(doc, 'span', 'hh-ix-step-status');
      ctl.appendChild(prev); ctl.appendChild(next); ctl.appendChild(status);
      rail.appendChild(ctl);
      var list = el(doc, 'ol', 'hh-ix-step-list');
      steps.forEach(function (s, i) {
        var li = el(doc, 'li');
        var b = el(doc, 'button', 'hh-ix-step', s.title || ('Step ' + (i + 1)));
        b.type = 'button';
        b.addEventListener('click', function () { go(i, b); });
        b.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -Infinity : e.key === 'End' ? Infinity : 0;
          if (!d) return;
          e.preventDefault();
          var j = d === -Infinity ? 0 : d === Infinity ? steps.length - 1 : Math.min(steps.length - 1, Math.max(0, i + d));
          go(j, stepButtons[j]);
        });
        li.appendChild(b);
        list.appendChild(li);
        stepButtons.push(b);
      });
      rail.appendChild(list);
      host.insertBefore(rail, panes);
      // aria-disabled, not disabled: a control the learner is using must never lose focus.
      prev.addEventListener('click', function () { go(current - 1, prev); });
      next.addEventListener('click', function () { go(current + 1, next); });
    }
    host.appendChild(live);

    function go(i, focusTarget) {
      if (i < 0 || i >= steps.length) return;
      current = i;
      if (!initial) visited[i] = true;
      var s = steps[i];
      ['left', 'right'].forEach(function (name) {
        var r = s[name];
        lineEls[name].forEach(function (line, k) {
          var on = k + 1 >= r[0] && k + 1 <= r[1];
          line.classList.toggle('hh-ix-ln--hl', on);
        });
        scrollTo(name, r[0]);
      });
      stepButtons.forEach(function (b, k) {
        b.setAttribute('aria-current', k === i ? 'step' : 'false');
        b.tabIndex = k === i ? 0 : -1;
      });
      prev.setAttribute('aria-disabled', String(i === 0));
      next.setAttribute('aria-disabled', String(i === steps.length - 1));
      status.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
      live.textContent = 'Step ' + (i + 1) + ' of ' + steps.length + ': ' + (s.title || '') + '. ' + it.left.label + ', lines ' + s.left[0] + ' to ' + s.left[1] + '. ' + it.right.label + ', lines ' + s.right[0] + ' to ' + s.right[1] + '.';
      if (focusTarget && doc.activeElement !== focusTarget) focusTarget.focus();
      if (it.completes_on === 'all_steps' && Object.keys(visited).length === steps.length && !host.hasAttribute('data-hh-finished')) {
        host.setAttribute('data-hh-finished', 'true');
        var evt;
        try { evt = new win.CustomEvent('hh:interactive-finish', { bubbles: true, detail: { id: it.id, event: 'all_steps' } }); } catch (_) { evt = null; }
        if (evt) host.dispatchEvent(evt);
      }
    }
    if (steps.length) {
      stepButtons.forEach(function (b, k) { b.tabIndex = k === 0 ? 0 : -1; });
      // First step is shown without moving focus or scrolling the page, and does not count as visited:
      // the learner has to step through it themselves for the finish event.
      go(0, null);
      initial = false;
    }
    return { ok: true, errors: [], warnings: problems.filter(function (p) { return p.level === 'warn'; }), label: label, derived: derived, go: go };
  }

  function autoMount(doc) {
    if (!doc || !doc.querySelectorAll) return;
    var run = function () {
      Array.prototype.forEach.call(doc.querySelectorAll('[data-hh-compare]'), function (host) {
        if (host.getAttribute('data-hh-mounted')) return;
        var script = host.querySelector('script[type="application/json"]');
        var payload = null;
        try { payload = JSON.parse(script ? script.textContent : ''); } catch (_) { payload = null; }
        if (!payload) return; // leave the server-rendered fallback prose in place
        host.setAttribute('data-hh-mounted', 'true');
        mount(host, payload);
      });
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run); else run();
  }

  return { analyse: analyse, weakestLabel: weakestLabel, checkCompare: checkCompare, realDate: realDate, plainTextProblem: plainTextProblem, mount: mount, autoMount: autoMount };
}));
