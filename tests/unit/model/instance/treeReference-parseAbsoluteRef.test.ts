/**
 * Unit tests for `parseAbsoluteRef` non-numeric predicate fail-loud behavior.
 *
 * sdd/setvalue-parity PR2, task 8 (design Decision 7 / ADR "parseAbsoluteRef
 * Non-Numeric Predicate Fail-Loud"): predicates other than a positive integer
 * literal (`[1]`, `[2]`, ...) must now throw instead of silently degrading to
 * `INDEX_UNBOUND`. This is an accepted breaking change in 0.x.
 */

import { describe, it, expect } from 'vitest';
import { parseAbsoluteRef } from '../../../../src/model/instance/TreeReference.ts';

describe('parseAbsoluteRef — non-numeric predicate fail-loud (Decision 7)', () => {
  it('throws on a position() predicate', () => {
    expect(() => parseAbsoluteRef('/data/r[position()=1]/x')).toThrow(/position/);
  });

  it('throws on an attribute-equality predicate', () => {
    expect(() => parseAbsoluteRef("/data/r[@x='y']/x")).toThrow(/@x/);
  });

  it('throws on a last() predicate', () => {
    expect(() => parseAbsoluteRef('/data/r[last()]/x')).toThrow(/last/);
  });

  it('still resolves a numeric predicate [1] to multiplicity 0', () => {
    const ref = parseAbsoluteRef('/data/r[1]/x');
    expect(ref.levels.map((l) => l.multiplicity)).toEqual([-1, 0, -1]);
  });

  it('still resolves a numeric predicate [2] to multiplicity 1', () => {
    const ref = parseAbsoluteRef('/data/r[2]/x');
    expect(ref.levels.map((l) => l.multiplicity)).toEqual([-1, 1, -1]);
  });

  it('still resolves a ref with no predicates at all', () => {
    const ref = parseAbsoluteRef('/data/a/b');
    expect(ref.levels.map((l) => l.name)).toEqual(['data', 'a', 'b']);
  });
});
