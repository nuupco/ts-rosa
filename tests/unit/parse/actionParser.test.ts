/**
 * Unit tests — `parseSetValueActions` multi-event splitting and jr-insert
 * body-nesting gate.
 *
 * sdd/setvalue-parity PR1 (Layer A: parser, multi-event + jr-insert gating).
 */

import { describe, it, expect } from 'vitest';
import { getXmlParser } from '../../../src/platform/XmlParser.ts';
import { parseSetValueActions, deriveGenericTarget } from '../../../src/parse/actionParser.ts';
import { parseAbsoluteRef } from '../../../src/model/instance/TreeReference.ts';

function setvalueEl(attrs: string): Element {
  const xml = `<root><setvalue ${attrs}/></root>`;
  const doc = getXmlParser().parse(xml);
  const children = doc.documentElement.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1) return child as Element;
  }
  throw new Error('setvalueEl: no element child found');
}

describe('parseSetValueActions', () => {
  it('returns one action for a single known event', () => {
    const el = setvalueEl('event="xforms-value-changed" ref="/data/x" value="1"');
    const actions = parseSetValueActions(el, null);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.event).toBe('xforms-value-changed');
  });

  it('returns N actions, one per token, for a space-separated event list, preserving declaration order', () => {
    const el = setvalueEl('event="xforms-ready odk-new-repeat" ref="/data/x" value="1"');
    const actions = parseSetValueActions(el, null);
    expect(actions).toHaveLength(2);
    expect(actions.map((a) => a.event)).toEqual(['odk-instance-first-load', 'odk-new-repeat']);
  });

  it('shares a single compiled expr/targetExpr across all actions from the same element', () => {
    const el = setvalueEl('event="xforms-ready odk-new-repeat" ref="/data/x" value="1"');
    const actions = parseSetValueActions(el, null);
    expect(actions[0]!.expr).toBe(actions[1]!.expr);
    expect(actions[0]!.targetExpr).toBe(actions[1]!.targetExpr);
  });

  it('rejects an unknown token in a multi-event list, naming the token', () => {
    const el = setvalueEl('event="xforms-value-changed not-a-real-event" ref="/data/x" value="1"');
    expect(() => parseSetValueActions(el, null)).toThrow(/not-a-real-event/);
  });

  it('accepts jr-insert on a model-level setvalue (hostRef === null)', () => {
    const el = setvalueEl('event="jr-insert" ref="/data/x" value="1"');
    const actions = parseSetValueActions(el, null);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.event).toBe('jr-insert');
  });

  it('rejects jr-insert on a body-nested setvalue (hostRef !== null)', () => {
    const el = setvalueEl('event="jr-insert" ref="x" value="1"');
    const hostRef = parseAbsoluteRef('/data/host');
    expect(() => parseSetValueActions(el, hostRef)).toThrow(/jr-insert/);
  });

  it('rejects jr-insert nested in a multi-event list on a body-nested setvalue', () => {
    const el = setvalueEl('event="xforms-value-changed jr-insert" ref="x" value="1"');
    const hostRef = parseAbsoluteRef('/data/host');
    expect(() => parseSetValueActions(el, hostRef)).toThrow(/jr-insert/);
  });
});

// ---------------------------------------------------------------------------
// deriveGenericTarget — sdd/setvalue-parity PR2, task 9 (design Decision 4)
// ---------------------------------------------------------------------------

describe('deriveGenericTarget', () => {
  it('strips predicates from an absolute ref and parses the rest', () => {
    const ref = deriveGenericTarget('/data/r[position()=1]/x', null, 'loc');
    expect(ref.levels.map((l) => l.name)).toEqual(['data', 'r', 'x']);
    expect(ref.levels.every((l) => l.multiplicity === -1)).toBe(true);
  });

  it('strips a numeric predicate from an absolute ref too', () => {
    const ref = deriveGenericTarget('/data/r[3]/x', null, 'loc');
    expect(ref.levels.map((l) => l.name)).toEqual(['data', 'r', 'x']);
    expect(ref.levels.every((l) => l.multiplicity === -1)).toBe(true);
  });

  it('contextualizes a relative ref onto hostRef when hostRef is provided', () => {
    const hostRef = parseAbsoluteRef('/data/g');
    const ref = deriveGenericTarget('x', hostRef, 'loc');
    expect(ref.levels.map((l) => l.name)).toEqual(['data', 'g', 'x']);
  });

  it('contextualizes a relative ref with a predicate onto hostRef, stripping the predicate first', () => {
    const hostRef = parseAbsoluteRef('/data/g');
    const ref = deriveGenericTarget('x[position()=1]', hostRef, 'loc');
    expect(ref.levels.map((l) => l.name)).toEqual(['data', 'g', 'x']);
  });

  it('throws when a relative ref has no hostRef to contextualize against', () => {
    expect(() => deriveGenericTarget('x', null, 'loc')).toThrow(/relative target ref/);
  });
});
