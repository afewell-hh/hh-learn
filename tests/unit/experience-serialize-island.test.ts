/**
 * RED (Phase 4, #485) — JSON-island safe serialization (NON-NEGOTIABLE gate).
 *
 * Pins serializeIsland(obj): the helper used at publish time to inject scenario
 * JSON into <script type="application/json"> without allowing script-context
 * escape or premature termination of the element.
 *
 * FAILS TODAY: src/experiences/serialize-island.ts does not exist yet (RED).
 * GREEN target: implement serializeIsland per #484 clarification
 *   (U+003C/U+003E/U+0026/U+2028/U+2029 -> \uXXXX escape output; lossless round-trip).
 */
import { serializeIsland } from '../../src/experiences/serialize-island';

// Adversarial scenario content: end-script-tag + reopened script, CDATA close,
// HTML comment open, and both Unicode line/paragraph separators (U+2028/U+2029).
const ADVERSARIAL = {
  scenarioId: 'fabric-operator',
  version: '1',
  narrative:
    'Try </script><script>alert(1)</script> and ]]> and <!-- comment --> and   and   end.',
};

describe('serializeIsland — JSON-island adversarial round-trip', () => {
  it('emits no literal </script>, <!--, or ]]> sequences', () => {
    const s = serializeIsland(ADVERSARIAL);
    expect(s).not.toContain('</script>');
    expect(s).not.toContain('<!--');
    expect(s).not.toContain(']]>');
    // No bare structural characters survive.
    expect(s).not.toContain('<');
    expect(s).not.toContain('>');
    expect(s).not.toContain('&');
  });

  it('escapes U+2028 and U+2029 (JS line/paragraph separators)', () => {
    const s = serializeIsland(ADVERSARIAL);
    expect(s).not.toContain(' ');
    expect(s).not.toContain(' ');
    expect(s).toContain('\\u2028');
    expect(s).toContain('\\u2029');
  });

  it('round-trips losslessly through JSON.parse (byte-for-byte object equality)', () => {
    const s = serializeIsland(ADVERSARIAL);
    expect(JSON.parse(s)).toEqual(ADVERSARIAL);
  });

  it('produces the documented \\u003c / \\u003e / \\u0026 escape output', () => {
    const s = serializeIsland({ t: '<>&' });
    expect(s).toContain('\\u003c');
    expect(s).toContain('\\u003e');
    expect(s).toContain('\\u0026');
  });
});
