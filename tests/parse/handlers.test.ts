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
