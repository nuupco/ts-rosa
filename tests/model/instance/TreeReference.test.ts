import { describe, it, expect } from 'vitest';
import {
  rootRef,
  selfRef,
  extendRef,
  parentOf,
  genericize,
  contextualize,
  refEquals,
  parseAbsoluteRef,
  REF_ABSOLUTE,
  type TreeReference,
  type RefContext,
} from '../../../src/model/instance/TreeReference';
import {
  INDEX_UNBOUND,
} from '../../../src/model/instance/multiplicity';

describe('TreeReference pure functions', () => {
  describe('rootRef()', () => {
    it('has refLevel === REF_ABSOLUTE (-1)', () => {
      const ref = rootRef();
      expect(ref.refLevel).toBe(REF_ABSOLUTE);
      expect(ref.refLevel).toBe(-1);
    });

    it('has empty levels', () => {
      expect(rootRef().levels).toEqual([]);
    });

    it('contextType is absolute', () => {
      expect(rootRef().contextType).toBe('absolute');
    });

    it('instanceName is null', () => {
      expect(rootRef().instanceName).toBeNull();
    });
  });

  describe('selfRef()', () => {
    it('has empty levels', () => {
      expect(selfRef().levels).toEqual([]);
    });

    it('is not absolute (refLevel !== REF_ABSOLUTE)', () => {
      expect(selfRef().refLevel).not.toBe(REF_ABSOLUTE);
    });
  });

  describe('extendRef()', () => {
    it('adds one level with the given name', () => {
      const ref = extendRef(rootRef(), 'name');
      expect(ref.levels).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ref.levels[0]!.name).toBe('name');
    });

    it('level predicates are always []', () => {
      const ref = extendRef(rootRef(), 'x');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ref.levels[0]!.predicates).toEqual([]);
    });

    it('chains two levels', () => {
      const ref = extendRef(extendRef(rootRef(), 'data'), 'name');
      expect(ref.levels).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ref.levels[0]!.name).toBe('data');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ref.levels[1]!.name).toBe('name');
    });

    it('returns a new reference (immutable)', () => {
      const root = rootRef();
      const extended = extendRef(root, 'child');
      expect(root.levels).toHaveLength(0);
      expect(extended.levels).toHaveLength(1);
    });
  });

  describe('parentOf()', () => {
    it('drops the last level', () => {
      const ref = extendRef(extendRef(rootRef(), 'data'), 'name');
      const parent = parentOf(ref);
      expect(parent.levels).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(parent.levels[0]!.name).toBe('data');
    });

    it('returns the root when called on a one-level ref', () => {
      const ref = extendRef(rootRef(), 'data');
      const parent = parentOf(ref);
      expect(parent.levels).toHaveLength(0);
    });
  });

  describe('genericize()', () => {
    it('sets all level multiplicities to INDEX_UNBOUND (-1)', () => {
      const ref = extendRef(extendRef(rootRef(), 'data'), 'name');
      const generic = genericize(ref);
      for (const lvl of generic.levels) {
        expect(lvl.multiplicity).toBe(INDEX_UNBOUND);
      }
    });

    it('preserves level names', () => {
      const ref = extendRef(rootRef(), 'data');
      const generic = genericize(ref);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(generic.levels[0]!.name).toBe('data');
    });

    it('predicates remain empty after genericize', () => {
      const ref = extendRef(rootRef(), 'item');
      const generic = genericize(ref);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(generic.levels[0]!.predicates).toEqual([]);
    });
  });

  describe('contextualize()', () => {
    it('anchors a relative self ref onto an absolute context', () => {
      const context = extendRef(rootRef(), 'data');
      const relative = selfRef();
      const result = contextualize(relative, context);
      expect(result.refLevel).toBe(REF_ABSOLUTE);
    });

    it('appends relative levels onto context levels', () => {
      const context = extendRef(rootRef(), 'data');
      const relative = extendRef(selfRef(), 'name');
      const result = contextualize(relative, context);
      expect(result.levels).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.levels[0]!.name).toBe('data');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.levels[1]!.name).toBe('name');
    });
  });

  describe('refEquals()', () => {
    it('same structural ref equals itself', () => {
      const a = extendRef(rootRef(), 'data');
      const b = extendRef(rootRef(), 'data');
      expect(refEquals(a, b)).toBe(true);
    });

    it('different paths are not equal', () => {
      const a = extendRef(rootRef(), 'data');
      const b = extendRef(rootRef(), 'other');
      expect(refEquals(a, b)).toBe(false);
    });
  });

  describe('parseAbsoluteRef()', () => {
    it('parses /data/name into two levels', () => {
      const ref = parseAbsoluteRef('/data/name');
      expect(ref.refLevel).toBe(REF_ABSOLUTE);
      expect(ref.levels).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ref.levels[0]!.name).toBe('data');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ref.levels[1]!.name).toBe('name');
    });

    it('each parsed level has multiplicity INDEX_UNBOUND', () => {
      const ref = parseAbsoluteRef('/data/name');
      for (const lvl of ref.levels) {
        expect(lvl.multiplicity).toBe(INDEX_UNBOUND);
      }
    });

    it('each parsed level has empty predicates', () => {
      const ref = parseAbsoluteRef('/data/item');
      for (const lvl of ref.levels) {
        expect(lvl.predicates).toEqual([]);
      }
    });

    it('parses a single-segment path', () => {
      const ref = parseAbsoluteRef('/data');
      expect(ref.levels).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(ref.levels[0]!.name).toBe('data');
    });
  });
});
