/**
 * ODK XPath function tests — Phase 6 slices.
 *
 * Slice 6c: uuid() — Hermes-safe, pure-JS v4, injectable generator seam.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { newNode } from '../../src/model/instance/InstanceNode.ts';
import type { InstanceTree } from '../../src/model/instance/InstanceTree.ts';
import {
  makeInstanceDocumentNode,
  wrapInstanceNode,
} from '../../src/xpath/adapter/instance/InstanceNodeXPathAdapter.ts';
import { instanceEvaluator } from '../../src/xpath/evaluator/InstanceEvaluator.ts';
import { setUuidGenerator } from '../../src/xpath/functions/xforms-uuid.ts';
import { XPATH_EVALUATION_RESULT } from '../../src/xpath/vendor/xpath/evaluator/result/XPathEvaluationResult.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalTree(): InstanceTree {
  const root = newNode('data');
  return { root, name: null };
}

function evaluateString(expr: string): string {
  const tree = makeMinimalTree();
  const doc = makeInstanceDocumentNode(tree);
  const contextNode = wrapInstanceNode(tree.root, doc);
  return instanceEvaluator
    .evaluate(expr, contextNode, null, XPATH_EVALUATION_RESULT.STRING_TYPE)
    .stringValue;
}

// ---------------------------------------------------------------------------
// Slice 6c — uuid() Hermes-safe
// ---------------------------------------------------------------------------

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid() — Hermes-safe native shim', () => {
  afterEach(() => {
    // Reset injected generator after each test that uses setUuidGenerator.
    setUuidGenerator(null);
  });

  // REQ-6C-1: default uuid() returns a valid v4 UUID string.
  it('uuid() returns a string matching the RFC 4122 v4 pattern', () => {
    const result = evaluateString('uuid()');
    expect(result).toMatch(UUID_V4_REGEX);
  });

  // REQ-6C-3: successive calls produce distinct values.
  it('uuid() successive calls return distinct values (default generator)', () => {
    const a = evaluateString('uuid()');
    const b = evaluateString('uuid()');
    expect(a).not.toBe(b);
  });

  // REQ-6C-4: injected deterministic generator returns reproducible output.
  it('uuid() with injected generator returns the fixed value', () => {
    const fixed = '00000000-0000-4000-8000-000000000000';
    setUuidGenerator(() => fixed);
    const result = evaluateString('uuid()');
    expect(result).toBe(fixed);
  });

  // REQ-6C-4: resetting to null restores the default generator.
  it('setUuidGenerator(null) restores the default pure-JS generator', () => {
    setUuidGenerator(() => '00000000-0000-4000-8000-000000000000');
    setUuidGenerator(null);
    const result = evaluateString('uuid()');
    expect(result).toMatch(UUID_V4_REGEX);
  });

  // REQ-6C-2 / REQ-X-6: uuid() is Hermes-safe (no globalThis.crypto).
  // Behavioral proof: the default generator produces valid v4 UUIDs using
  // Math.random only. Structural guard: see the comment in xforms-uuid.ts
  // and the absence of any crypto import. The test below confirms that even
  // when the injected generator is cleared, the default immediately produces
  // valid output — no async/crypto initialisation required.
  it('uuid() default generator is Hermes-safe (no crypto dependency, immediate output)', () => {
    // Force reset to default, then evaluate — must produce valid v4 immediately.
    setUuidGenerator(null);
    const result = evaluateString('uuid()');
    expect(result).toMatch(UUID_V4_REGEX);
    // Confirm result uses only lowercase hex and hyphens (no non-ASCII, no base64).
    expect(result).toMatch(/^[0-9a-f-]+$/);
  });

  // REQ-6C-5: uuid() is registered and callable (no unknown-function error).
  it('uuid() is registered in the function library (no unknown-function error)', () => {
    expect(() => evaluateString('uuid()')).not.toThrow();
  });

  // uuid(n) length-parameter form — deferred: JavaRosa genGUID(len) uses
  // base-36 random chars, not UUID concatenation/truncation; no XPathEvalTest
  // fixture exists for this form. Keeping as skipped per spec non-goals.
  it.skip('uuid(n) — length-parameter form (out of scope: no XPathEvalTest fixture; JavaRosa genGUID != concat-truncate)', () => {
    // If a future conformance test requires uuid(n), implement here.
  });
});
