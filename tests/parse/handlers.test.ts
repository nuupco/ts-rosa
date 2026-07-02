/**
 * Tests for handlers.ts (T-1.4.3 RED → T-1.4.4 GREEN)
 */

import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { bodyHandlers } from '../../src/parse/handlers.ts';
import type { BuildCtx } from '../../src/parse/handlers.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseElement(xml: string): Element {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return doc.documentElement as unknown as Element;
}

const emptyCtx: BuildCtx = { bindings: new Map() };

// ---------------------------------------------------------------------------
// Handler map presence
// ---------------------------------------------------------------------------

describe('bodyHandlers map', () => {
  it('has "input" key', () => {
    expect(bodyHandlers.has('input')).toBe(true);
  });

  it('has "select1" key', () => {
    expect(bodyHandlers.has('select1')).toBe(true);
  });

  it('has "select" key', () => {
    expect(bodyHandlers.has('select')).toBe(true);
  });

  it('has "group" key', () => {
    expect(bodyHandlers.has('group')).toBe(true);
  });

  it('has "repeat" key', () => {
    expect(bodyHandlers.has('repeat')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// input handler
// ---------------------------------------------------------------------------

describe('input handler', () => {
  it('returns kind=question, controlType=input', () => {
    const el = parseElement('<input ref="/data/name"/>');
    const handler = bodyHandlers.get('input')!;
    const fe = handler(el, emptyCtx);
    expect(fe.kind).toBe('question');
    if (fe.kind === 'question') {
      expect(fe.controlType).toBe('input');
    }
  });

  it('extracts labelText from <label> child', () => {
    const el = parseElement('<input ref="/data/name"><label>Your Name</label></input>');
    const handler = bodyHandlers.get('input')!;
    const fe = handler(el, emptyCtx);
    if (fe.kind === 'question') {
      expect(fe.labelText).toBe('Your Name');
    }
  });

  it('labelText is null when no label element', () => {
    const el = parseElement('<input ref="/data/name"/>');
    const handler = bodyHandlers.get('input')!;
    const fe = handler(el, emptyCtx);
    if (fe.kind === 'question') {
      expect(fe.labelText).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// output-label-substitution PR2 — parse-time output expression capture
// ---------------------------------------------------------------------------

describe('input handler — label/hint output capture', () => {
  it('captures labelOutputs aligned with the ${n} placeholders in labelInnerText', () => {
    const el = parseElement(
      '<input ref="/data/name"><label>Hello, <output value="/data/name"/></label></input>',
    );
    const handler = bodyHandlers.get('input')!;
    const fe = handler(el, emptyCtx);
    if (fe.kind === 'question') {
      expect(fe.labelInnerText).toBe('Hello, ${0}');
      expect(fe.labelOutputs).toEqual(['/data/name']);
    }
  });

  it('labelOutputs is an empty array when the label has no <output>', () => {
    const el = parseElement('<input ref="/data/name"><label>Your Name</label></input>');
    const handler = bodyHandlers.get('input')!;
    const fe = handler(el, emptyCtx);
    if (fe.kind === 'question') {
      expect(fe.labelOutputs).toEqual([]);
    }
  });

  it('captures hintInnerText and hintOutputs for a hint with an <output>', () => {
    const el = parseElement(
      '<input ref="/data/x"><label>X</label><hint>Value is <output value="/data/x"/></hint></input>',
    );
    const handler = bodyHandlers.get('input')!;
    const fe = handler(el, emptyCtx);
    if (fe.kind === 'question') {
      expect(fe.hintInnerText).toBe('Value is ${0}');
      expect(fe.hintOutputs).toEqual(['/data/x']);
    }
  });

  it('hintOutputs is an empty array when there is no hint element', () => {
    const el = parseElement('<input ref="/data/name"><label>Your Name</label></input>');
    const handler = bodyHandlers.get('input')!;
    const fe = handler(el, emptyCtx);
    if (fe.kind === 'question') {
      expect(fe.hintOutputs).toEqual([]);
      expect(fe.hintInnerText).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// select1 handler
// ---------------------------------------------------------------------------

describe('select1 handler', () => {
  it('returns kind=question, controlType=select1', () => {
    const el = parseElement('<select1 ref="/data/choice"/>');
    const handler = bodyHandlers.get('select1')!;
    const fe = handler(el, emptyCtx);
    expect(fe.kind).toBe('question');
    if (fe.kind === 'question') {
      expect(fe.controlType).toBe('select1');
    }
  });

  it('extracts <item> children into choices', () => {
    const el = parseElement(
      '<select1 ref="/data/choice"><item><value>a</value><label>A</label></item></select1>'
    );
    const handler = bodyHandlers.get('select1')!;
    const fe = handler(el, emptyCtx);
    if (fe.kind === 'question') {
      expect(fe.choices.length).toBe(1);
      expect(fe.choices[0]?.value).toBe('a');
      expect(fe.choices[0]?.labelText).toBe('A');
    }
  });
});

// ---------------------------------------------------------------------------
// select handler
// ---------------------------------------------------------------------------

describe('select handler', () => {
  it('returns kind=question, controlType=select', () => {
    const el = parseElement('<select ref="/data/multi"/>');
    const handler = bodyHandlers.get('select')!;
    const fe = handler(el, emptyCtx);
    expect(fe.kind).toBe('question');
    if (fe.kind === 'question') {
      expect(fe.controlType).toBe('select');
    }
  });
});

// ---------------------------------------------------------------------------
// range handler
// ---------------------------------------------------------------------------

describe('range handler', () => {
  it('returns kind=question, controlType=range', () => {
    const el = parseElement('<range ref="/data/rating"/>');
    const handler = bodyHandlers.get('range')!;
    const fe = handler(el, emptyCtx);
    expect(fe.kind).toBe('question');
    if (fe.kind === 'question') {
      expect(fe.controlType).toBe('range');
    }
  });

  it('parses start, end, step attributes as numbers', () => {
    const el = parseElement('<range ref="/data/rating" start="1" end="100" step="5"/>');
    const handler = bodyHandlers.get('range')!;
    const fe = handler(el, emptyCtx);
    expect(fe.kind).toBe('question');
    if (fe.kind === 'question') {
      expect(fe.rangeStart).toBe(1);
      expect(fe.rangeEnd).toBe(100);
      expect(fe.rangeStep).toBe(5);
    }
  });

  it('parses decimal bounds', () => {
    const el = parseElement('<range ref="/data/rating" start="0.5" end="10.5" step="0.5"/>');
    const handler = bodyHandlers.get('range')!;
    const fe = handler(el, emptyCtx);
    expect(fe.kind).toBe('question');
    if (fe.kind === 'question') {
      expect(fe.rangeStart).toBe(0.5);
      expect(fe.rangeEnd).toBe(10.5);
      expect(fe.rangeStep).toBe(0.5);
    }
  });

  it('ignores malformed start, keeps valid end', () => {
    const el = parseElement('<range ref="/data/rating" start="abc" end="10"/>');
    const handler = bodyHandlers.get('range')!;
    const fe = handler(el, emptyCtx);
    expect(fe.kind).toBe('question');
    if (fe.kind === 'question') {
      expect(fe.rangeStart).toBeUndefined();
      expect(fe.rangeEnd).toBe(10);
      expect(fe.rangeStep).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// group handler
// ---------------------------------------------------------------------------

describe('group handler', () => {
  it('returns kind=group with children recursed', () => {
    const el = parseElement(
      '<group ref="/data/g"><input ref="/data/g/name"/></group>'
    );
    const handler = bodyHandlers.get('group')!;
    const fe = handler(el, emptyCtx);
    expect(fe.kind).toBe('group');
    if (fe.kind === 'group') {
      expect(fe.children.length).toBe(1);
      expect(fe.children[0]?.kind).toBe('question');
    }
  });
});
