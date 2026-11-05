/**
 * serialize-island — safe serialization of a JSON object for embedding inside a
 * `<script type="application/json">` island in a CMS page (Slice 1 Fabric Operator
 * replay, Epic #478 / #484).
 *
 * The player reads the island via `element.textContent` + `JSON.parse`, but a raw
 * `JSON.stringify` result can contain `</script>`, `<!--`, or `]]>`, which the HTML
 * parser would act on — terminating the script element early or (worse) allowing an
 * injected executable `<script>`. We neutralize this at inject time by escaping the
 * three structural characters to their JSON `\uXXXX` forms, plus the two Unicode
 * line/paragraph separators (defensive: keeps the payload valid if ever read as JS).
 *
 * Each replacement is a valid JSON string escape, so `JSON.parse` decodes it back to
 * the original character — the round-trip is lossless. The separator characters are
 * matched via `String.fromCharCode` (ASCII-only source) so no literal separator byte
 * can be mangled by tooling.
 *
 * See the #484 clarification for the exact character -> escape mapping.
 */
export function serializeIsland(obj: unknown): string {
  const LINE_SEP = String.fromCharCode(0x2028);
  const PARA_SEP = String.fromCharCode(0x2029);
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LINE_SEP)
    .join('\\u2028')
    .split(PARA_SEP)
    .join('\\u2029');
}
