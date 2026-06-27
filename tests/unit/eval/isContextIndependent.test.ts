/**
 * Unit tests for the isContextIndependent broadcast guard in FormEvaluator.
 *
 * isContextIndependent is not exported; we access it via the module's internal
 * test seam by re-exporting it through a dedicated test export, OR we exercise
 * it indirectly. Because it is not exported, we use a local reimplementation
 * copy here that mirrors the function exactly — this lets us write RED-first
 * tests against the BUGGY regex, then update to the FIXED regex.
 *
 * NOTE: We test the actual exported logic by importing the module's private
 * copy via a test-only export added to FormEvaluator (see TESTONLY_isContextIndependent).
 */
import { describe, expect, it } from 'vitest';
import { TESTONLY_isContextIndependent } from '../../../src/session/FormEvaluator';

describe('isContextIndependent broadcast guard', () => {
  describe('context-DEPENDENT expressions (must return false)', () => {
    it('relative step after + operator: count(/data/rep) + foo', () => {
      expect(TESTONLY_isContextIndependent('count(/data/rep) + foo')).toBe(false);
    });

    it('relative step after - operator: /data/x - bar', () => {
      expect(TESTONLY_isContextIndependent('/data/x - bar')).toBe(false);
    });

    it('relative step after * operator: /data/x * baz', () => {
      expect(TESTONLY_isContextIndependent('/data/x * baz')).toBe(false);
    });

    it('relative step after | operator: /data/a | relNode', () => {
      expect(TESTONLY_isContextIndependent('/data/a | relNode')).toBe(false);
    });

    it('relative step after = operator: /data/x = relVal', () => {
      expect(TESTONLY_isContextIndependent('/data/x = relVal')).toBe(false);
    });

    it('relative step after != operator: /data/x != relVal', () => {
      expect(TESTONLY_isContextIndependent('/data/x != relVal')).toBe(false);
    });

    it('relative step after < operator: /data/x < relVal', () => {
      expect(TESTONLY_isContextIndependent('/data/x < relVal')).toBe(false);
    });

    it('relative step after > operator: /data/x > relVal', () => {
      expect(TESTONLY_isContextIndependent('/data/x > relVal')).toBe(false);
    });

    it('parent-axis step: ../val * 2', () => {
      expect(TESTONLY_isContextIndependent('../val * 2')).toBe(false);
    });

    it('bare relative step at start: foo', () => {
      expect(TESTONLY_isContextIndependent('foo')).toBe(false);
    });

    it('relative step in function arg after comma: concat(/data/x, relStep)', () => {
      expect(TESTONLY_isContextIndependent('concat(/data/x, relStep)')).toBe(false);
    });
  });

  describe('context-INDEPENDENT expressions (must return true)', () => {
    it('pure absolute path: /data/field', () => {
      expect(TESTONLY_isContextIndependent('/data/field')).toBe(true);
    });

    it('absolute paths with if(): if(/data/building_type=\'single\', /data/a, /data/b)', () => {
      expect(
        TESTONLY_isContextIndependent("if(/data/building_type='single', /data/a, /data/b)")
      ).toBe(true);
    });

    it('aggregate over absolute path: count(/data/rep)', () => {
      expect(TESTONLY_isContextIndependent('count(/data/rep)')).toBe(true);
    });

    it('function call with absolute args: concat(/data/x, /data/y)', () => {
      expect(TESTONLY_isContextIndependent('concat(/data/x, /data/y)')).toBe(true);
    });

    it('numeric literal expression: 1 + 2', () => {
      expect(TESTONLY_isContextIndependent('1 + 2')).toBe(true);
    });

    it('string literal: "hello"', () => {
      expect(TESTONLY_isContextIndependent('"hello"')).toBe(true);
    });

    it('now() with no args', () => {
      expect(TESTONLY_isContextIndependent('now()')).toBe(true);
    });
  });
});
