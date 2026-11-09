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

  // Customer direction 2026-11-09: name SemiAnalysis, because the name carries weight, but
  // never as having rated the fabric -- they review GPU clouds, not fabrics, and their
  // published FarmGPU report said next to nothing about the network. The chain lives in the
  // small print with a link to FarmGPU's own account. These two assertions are the guard:
  // the name may not appear without the qualifier, and the qualifier may not drift.
  it('names SemiAnalysis only alongside the small print that qualifies it', () => {
    const QUALIFIER =
      "SemiAnalysis review GPU clouds, not fabrics. The figures are FarmGPU's own, " +
      'from the cluster SemiAnalysis reviewed, which runs a Hedgehog and Celestica fabric.';
    expect(text).toContain(QUALIFIER);
    expect(html).toMatch(/<p class="smallprint">[\s\S]*?blog\.farmgpu\.com[\s\S]*?<\/p>/);
    // Every mention of the name is inside the primary card, which carries the qualifier.
    const card = html.match(/<li class="primary" id="path-performance">[\s\S]*?<\/li>/)![0];
    const onPage = (text.match(/SemiAnalysis/g) ?? []).length;
    const inCard = (card.match(/SemiAnalysis/g) ?? []).length;
    expect(onPage).toBeGreaterThan(0);
    expect(inCard).toBe(onPage);
  });

  it('never claims SemiAnalysis rated, benchmarked or measured the fabric', () => {
    expect(text).not.toMatch(/\bindependent/i);
    expect(text).not.toMatch(/third.?part/i);
    expect(text).not.toMatch(/clustermax/i);
    expect(text).not.toMatch(/SemiAnalysis[^.]{0,80}\b(rated|ranked|benchmark|measured|tested|scored)/i);
  });

  it('does not restate the figures or reach for superlatives', () => {
    expect(text).not.toMatch(/\d+\s?%|\d+\s?GB\/s|outperform|fastest|best in|industry.leading/i);
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
