/**
 * Unit tests for the enhanced bindProcessor — Slice 3.2-T4 (test-first).
 *
 * Verifies that bindProcessor2 (the Phase 3 version) compiles each DataBinding
 * expression to a CompiledInstanceExpression and extracts its triggers via
 * getTriggers, producing CompiledBinding records.
 */

import { describe, expect, it } from 'vitest';
import { bindProcessor2, type CompiledBinding } from '../../../src/parse/bindProcessor2.ts';
import { refToString, parseAbsoluteRef } from '../../../src/model/instance/TreeReference.ts';

// ---------------------------------------------------------------------------
// Helpers: build minimal DataBinding-like objects
// ---------------------------------------------------------------------------

function makeBindElement(attrs: Record<string, string>): Element {
  // Build a synthetic Element-like object for testing
  const el = {
    getAttribute(name: string): string | null {
      return attrs[name] ?? null;
    },
  } as unknown as Element;
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bindProcessor2 — CompiledBinding production', () => {
  it('binding with no expressions produces a CompiledBinding with empty triggers', () => {
    const el = makeBindElement({ nodeset: '/data/name' });
    const result = bindProcessor2([el]);

    expect(result.size).toBe(1);
    const binding = result.get('/data/name');
    expect(binding).toBeDefined();
    expect(binding!.compiledBindings).toHaveLength(0);
  });

  it('calculate expression is compiled and has trigger extracted', () => {
    const el = makeBindElement({
      nodeset: '/data/total',
      calculate: '/data/a + /data/b',
    });
    const result = bindProcessor2([el]);
    const binding = result.get('/data/total');
    expect(binding).toBeDefined();

    const calcBinding = binding!.compiledBindings.find((cb) => cb.kind === 'recalculate');
    expect(calcBinding).toBeDefined();
    expect(calcBinding!.triggers.map(refToString).sort()).toEqual(['/data/a', '/data/b'].sort());
  });

  it('relevant expression produces a Condition with triggers', () => {
    const el = makeBindElement({
      nodeset: '/data/fieldB',
      relevant: '/data/fieldA = "yes"',
    });
    const result = bindProcessor2([el]);
    const binding = result.get('/data/fieldB');
    expect(binding).toBeDefined();

    const relBinding = binding!.compiledBindings.find(
      (cb) => cb.kind === 'condition' && cb.action === 'relevant'
    );
    expect(relBinding).toBeDefined();
    expect(relBinding!.triggers.map(refToString)).toContain('/data/fieldA');
  });

  it('required expression produces a Condition with action=required', () => {
    const el = makeBindElement({
      nodeset: '/data/name',
      required: '/data/needsName = "true"',
    });
    const result = bindProcessor2([el]);
    const binding = result.get('/data/name');
    const reqBinding = binding!.compiledBindings.find(
      (cb) => cb.kind === 'condition' && cb.action === 'required'
    );
    expect(reqBinding).toBeDefined();
    expect(reqBinding!.triggers.map(refToString)).toContain('/data/needsName');
  });

  it('readonly expression produces a Condition with action=readonly', () => {
    const el = makeBindElement({
      nodeset: '/data/computed',
      readonly: 'true()',
    });
    const result = bindProcessor2([el]);
    const binding = result.get('/data/computed');
    const roBinding = binding!.compiledBindings.find(
      (cb) => cb.kind === 'condition' && cb.action === 'readonly'
    );
    expect(roBinding).toBeDefined();
    // true() has no triggers
    expect(roBinding!.triggers).toHaveLength(0);
  });

  it('constraint expression produces a Condition with action=constraint', () => {
    const el = makeBindElement({
      nodeset: '/data/score',
      constraint: '. >= 0 and . <= 100',
    });
    const result = bindProcessor2([el]);
    const binding = result.get('/data/score');
    const constraintBinding = binding!.compiledBindings.find(
      (cb) => cb.kind === 'condition' && cb.action === 'constraint'
    );
    expect(constraintBinding).toBeDefined();
    // . self-ref in constraint should NOT produce triggers (per design §2.3)
    // OR it contextualizes to /data/score — both are valid; check it is defined
    expect(constraintBinding!.triggers).toBeDefined();
  });

  it('calculate constant expression has no triggers (DAG root)', () => {
    const el = makeBindElement({
      nodeset: '/data/constant',
      calculate: '42',
    });
    const result = bindProcessor2([el]);
    const binding = result.get('/data/constant');
    const calcBinding = binding!.compiledBindings.find((cb) => cb.kind === 'recalculate');
    expect(calcBinding).toBeDefined();
    expect(calcBinding!.triggers).toHaveLength(0);
  });

  it('multiple bindings are all processed', () => {
    const binds = [
      makeBindElement({ nodeset: '/data/a' }),
      makeBindElement({ nodeset: '/data/b', calculate: '/data/a * 2' }),
      makeBindElement({ nodeset: '/data/c', relevant: '/data/b > 10' }),
    ];
    const result = bindProcessor2(binds);
    expect(result.size).toBe(3);
    expect(result.has('/data/a')).toBe(true);
    expect(result.has('/data/b')).toBe(true);
    expect(result.has('/data/c')).toBe(true);

    const bBinding = result.get('/data/b');
    const calcB = bBinding!.compiledBindings.find((cb) => cb.kind === 'recalculate');
    expect(calcB!.triggers.map(refToString)).toContain('/data/a');
  });

  it('contextRef and originalContextRef match the binding ref', () => {
    const el = makeBindElement({
      nodeset: '/data/field',
      calculate: '/data/other + 1',
    });
    const result = bindProcessor2([el]);
    const binding = result.get('/data/field');
    const calcBinding = binding!.compiledBindings.find((cb) => cb.kind === 'recalculate');
    expect(calcBinding).toBeDefined();
    expect(refToString(calcBinding!.contextRef)).toBe('/data/field');
    expect(refToString(calcBinding!.originalContextRef)).toBe('/data/field');
  });
});
