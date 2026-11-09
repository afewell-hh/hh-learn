import { readFileSync } from 'fs';
import { join } from 'path';

const html = readFileSync(join(__dirname, '../../content/journeys/discovery-junction/index.html'), 'utf8');
// Visible copy only: drop comments, style and tags.
const text = html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ');

describe('#529 discovery junction (offline)', () => {
  it('frames the page as AI networking, not as SONiC manageability', () => {
    expect(text).toMatch(/AI network/);
    expect(text).not.toMatch(/sonic/i);
  });

  // Customer direction 2026-11-09: the top line stays general, because the premise that
  // the network drives AI workload performance and job completion time is already widely
  // held, whereas the need for segmentation is not. Narrower use-case messaging keeps its
  // own card but must not lead.
  it('leads on the general premise: performance and job completion time, not segmentation', () => {
    expect(text).toMatch(/how long jobs take to finish/);
    expect(html).toMatch(/<li class="primary" id="path-performance">/);
  });

  it('keeps the security message as its own card, under the customer-verbatim label', () => {
    expect(text).toContain('Shrink the blast radius');
    expect(html).toMatch(/<li id="path-segmentation">/);
  });

  // Settled against source on 2026-11-09. NCCL/RCCL networking performance is one of the
  // ClusterMAX criteria SemiAnalysis test, and hedgehog.cloud's own FarmGPU case study
  // credits the comparison graph and the all-reduce figure to them ("Source: SemiAnalysis").
  // So the data is theirs and the page uses it. The one thing they do NOT do is rate
  // fabrics: they rate GPU clouds, and publish no per-provider network rating. That limit
  // goes in the small print, and these assertions are the guard -- the name may not appear
  // without the qualifier, and the qualifier may not drift.
  it('names SemiAnalysis only alongside the small print that qualifies it', () => {
    const QUALIFIER =
      'SemiAnalysis NCCL data, from their ClusterMAX testing of clouds that run this ' +
      'fabric. They rate clouds, not fabrics, so there is no SemiAnalysis rating of ' +
      'Hedgehog itself.';
    expect(text).toContain(QUALIFIER);
    expect(html).toMatch(/<p class="smallprint">/);
    // Every mention of the name sits in the primary card, which carries the qualifier.
    const card = html.match(/<li class="primary" id="path-performance">[\s\S]*?<\/li>/)![0];
    const onPage = (text.match(/SemiAnalysis/g) ?? []).length;
    const inCard = (card.match(/SemiAnalysis/g) ?? []).length;
    expect(onPage).toBeGreaterThan(0);
    expect(inCard).toBe(onPage);
  });

  it('never claims a SemiAnalysis rating or certification of Hedgehog', () => {
    expect(text).not.toMatch(/SemiAnalysis\s+(rated|ranked|scored|certified|awarded)/i);
    expect(text).not.toMatch(/ClusterMAX\s+(rating|score|grade)\s+(for|of)\s+Hedgehog/i);
    expect(text).not.toMatch(/third.?part/i);
  });

  // A comparative RESULT may be stated, because it is SemiAnalysis data published on
  // hedgehog.cloud and the source is named in the same sentence -- the customer's direction
  // is to use the material fully without overstating it. "outperform" was previously banned
  // here; that ban was removed deliberately rather than worked around with a synonym.
  // UNSOURCED superlatives stay banned, as do restated figures.
  it('states no figures and no unsourced superlatives', () => {
    expect(text).not.toMatch(/\d+\s?%|\d+\s?GB\/s/i);
    expect(text).not.toMatch(/fastest|best in|industry.leading|unmatched|world.class/i);
  });

  it('never claims isolation (binding copy rule)', () => {
    expect(text).not.toMatch(/provabl|guarantee|proven|\bprove\b|isolat|impenetrable|breach.?proof|zero.?trust/i);
  });

  it('keeps multi-tenancy language out of the entry (it lives in the destination)', () => {
    expect(text).not.toMatch(/multi-?tenan/i);
  });

  it('preserves a real, honestly labelled Download route', () => {
    expect(html).toMatch(/data-destination="download"[^>]*>Download<\/a>/);
    expect(html.match(/>Download</g)).toHaveLength(1);
  });

  it('makes contact secondary: one text link outside the path list', () => {
    expect(html.match(/data-destination="contact"/g)).toHaveLength(1);
    const list = html.match(/<ul class="paths">[\s\S]*?<\/ul>/)![0];
    expect(list).not.toContain('data-destination="contact"');
  });

  it('is not profiling machinery: no script, form, input or event hooks', () => {
    expect(html).not.toMatch(/<script|<form|<input|<select|<button|onclick|fetch\(|beacon/i);
  });

  it('wires only the verified destinations; everything else stays an honest placeholder', () => {
    const allowed = new Set([
      'https://hedgehog.cloud/case-studies/farmgpu',
      'https://blog.farmgpu.com/building-an-ai-cluster-our-17-day-crash-course-in-open-networking/',
      'https://hedgehog.cloud/blog/industry-leading-ai-network-performance',
      'https://hedgehog.cloud/network-performance',
      'https://hedgehog.cloud/ocp-reference-architecture-for-ai-networks',
      'https://hedgehog.cloud/download',
    ]);
    const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map(m => m[0]);
    for (const a of anchors) {
      const href = /href="([^"]*)"/.exec(a)![1];
      if (href === '#') expect(a).toMatch(/data-link-status="(pending-527-route|provisional-488-route|pending-url)"/);
      else expect(allowed.has(href)).toBe(true);
    }
    expect(html).not.toContain('pending-owner');
  });
});
