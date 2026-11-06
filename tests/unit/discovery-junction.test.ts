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
  it('uses the customer-selected segmentation label verbatim, as the primary card', () => {
    expect(text).toContain('Shrink the blast radius');
    expect(html).toMatch(/<li class="primary" id="path-segmentation">/);
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
      'https://hedgehog.cloud/network-performance',
      'https://hedgehog.cloud/case-studies/farmgpu',
      'https://hedgehog.cloud/blog/industry-leading-ai-network-performance',
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

  it('cites performance material as published by Hedgehog and does not restate its numbers', () => {
    expect(text).toMatch(/Published by Hedgehog, not measured here/);
    expect(text).not.toMatch(/\d+\s?%|\d+\s?GB\/s|outperform/i);
  });
});
