/**
 * Tests for domHelpers.ts — parseTextParts (output-label-substitution PR2)
 */

import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { parseTextParts, labelInnerText } from '../../src/parse/domHelpers.ts';

function parseElement(xml: string): Element {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return doc.documentElement as unknown as Element;
}

describe('parseTextParts', () => {
  it('returns null for an empty element', () => {
    const el = parseElement('<label></label>');
    expect(parseTextParts(el)).toBeNull();
  });

  it('returns text with no outputs when there is no <output> child', () => {
    const el = parseElement('<label>Your Name</label>');
    const parts = parseTextParts(el);
    expect(parts).toEqual({ text: 'Your Name', outputs: [] });
  });

  it('captures a single output expression aligned with its ${0} placeholder', () => {
    const el = parseElement('<label>Hello, <output value="/data/name"/></label>');
    const parts = parseTextParts(el);
    expect(parts).toEqual({ text: 'Hello, ${0}', outputs: ['/data/name'] });
  });

  it('captures multiple output expressions in document order', () => {
    const el = parseElement(
      '<label><output value="/data/a"/> and <output value="/data/b"/></label>',
    );
    const parts = parseTextParts(el);
    expect(parts).toEqual({ text: '${0} and ${1}', outputs: ['/data/a', '/data/b'] });
  });

  it('captures outputs inside a <hint> element the same way as <label>', () => {
    const el = parseElement('<hint>Value is <output value="/data/x"/></hint>');
    const parts = parseTextParts(el);
    expect(parts).toEqual({ text: 'Value is ${0}', outputs: ['/data/x'] });
  });

  it('an output with no value attribute captures an empty string expression', () => {
    const el = parseElement('<label>Hi <output/></label>');
    const parts = parseTextParts(el);
    expect(parts).toEqual({ text: 'Hi ${0}', outputs: [''] });
  });
});

describe('labelInnerText compat wrapper', () => {
  it('still returns only the placeholder text (no outputs)', () => {
    const el = parseElement('<label>Hello, <output value="/data/name"/></label>');
    expect(labelInnerText(el)).toBe('Hello, ${0}');
  });

  it('returns null for an empty label', () => {
    const el = parseElement('<label></label>');
    expect(labelInnerText(el)).toBeNull();
  });
});
