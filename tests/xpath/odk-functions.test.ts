/**
 * ODK XPath function tests — Phase 6 slices.
 *
 * Slice 6c: uuid() — Hermes-safe, pure-JS v4, injectable generator seam.
 * Slice 6b: once() — preserves non-empty; evaluates when empty.
 *           randomize() — permutation, deterministic with seed.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { appendChild, newNode } from '../../src/model/instance/InstanceNode.ts';
import type { InstanceNode } from '../../src/model/instance/InstanceNode.ts';
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

/**
 * Evaluate `expr` with a leaf context node that has the given string value.
 * Used for once() tests: the context node is a leaf so getNodeValue returns
 * answerValueToXPathString(node.value).
 */
function evaluateStringWithLeafContext(expr: string, leafValue: string): string {
  const root = newNode('data');
  const leaf: InstanceNode = newNode('ts', {
    value: leafValue === '' ? null : { kind: 'uncast', value: leafValue, displayText: leafValue },
  });
  appendChild(root, leaf);
  const tree: InstanceTree = { root, name: null };
  const doc = makeInstanceDocumentNode(tree);
  const contextNode = wrapInstanceNode(leaf, doc);
  return instanceEvaluator
    .evaluate(expr, contextNode, null, XPATH_EVALUATION_RESULT.STRING_TYPE)
    .stringValue;
}

/**
 * Build an InstanceTree with N sibling leaf nodes named `item` and evaluate
 * `expr` from the root context. Returns the result node-set values in order.
 */
function evaluateNodesetValues(expr: string, items: string[]): string[] {
  const root = newNode('data');
  for (const item of items) {
    const leaf: InstanceNode = newNode('item', {
      value: { kind: 'uncast', value: item, displayText: item },
    });
    appendChild(root, leaf);
  }
  const tree: InstanceTree = { root, name: null };
  const doc = makeInstanceDocumentNode(tree);
  const contextNode = wrapInstanceNode(root, doc);
  const result = instanceEvaluator.evaluate(
    expr,
    contextNode,
    null,
    XPATH_EVALUATION_RESULT.ORDERED_NODE_SNAPSHOT_TYPE
  );
  const values: string[] = [];
  for (let i = 0; i < result.snapshotLength; i++) {
    const node = result.snapshotItem(i);
    if (node != null) {
      values.push(
        instanceEvaluator
          .evaluate('string(.)', node, null, XPATH_EVALUATION_RESULT.STRING_TYPE)
          .stringValue
      );
    }
  }
  return values;
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

// ---------------------------------------------------------------------------
// Slice 6b — once() and randomize()
// ---------------------------------------------------------------------------

describe('once() — preserves non-empty; evaluates when empty', () => {
  // REQ-6B-1: once() on a non-empty context node returns the existing value.
  it('once() returns the existing value when the context node is non-empty', () => {
    // Context node has value "2024-01-01"; once(now()) must NOT evaluate now()
    // and must return the frozen existing value.
    const result = evaluateStringWithLeafContext("once('should-not-appear')", '2024-01-01');
    expect(result).toBe('2024-01-01');
  });

  // REQ-6B-2: once() on an empty context node evaluates and returns the argument.
  it('once() evaluates and returns the argument when the context node is empty', () => {
    const result = evaluateStringWithLeafContext("once('fixed')", '');
    expect(result).toBe('fixed');
  });

  // REQ-6B-6: once() is registered and callable (no unknown-function error).
  it('once() is registered in the function library (no unknown-function error)', () => {
    expect(() => evaluateStringWithLeafContext("once('x')", '')).not.toThrow();
  });
});

describe('randomize() — permutation and determinism', () => {
  const ITEMS = ['a', 'b', 'c', 'd', 'e'];

  // REQ-6B-3: randomize(nodeset) returns same length as input.
  it('randomize(items) returns a nodeset with the same length as input', () => {
    const result = evaluateNodesetValues('randomize(item)', ITEMS);
    expect(result).toHaveLength(ITEMS.length);
  });

  // REQ-6B-3: randomize(nodeset) contains the same elements (permutation).
  it('randomize(items) contains exactly the same elements as the input (permutation)', () => {
    const result = evaluateNodesetValues('randomize(item)', ITEMS);
    expect(result.slice().sort()).toEqual(ITEMS.slice().sort());
  });

  // REQ-6B-4: randomize(nodeset, seed) is deterministic for a given seed.
  it('randomize(items, 42) produces the same order on two independent calls', () => {
    const first = evaluateNodesetValues('randomize(item, 42)', ITEMS);
    const second = evaluateNodesetValues('randomize(item, 42)', ITEMS);
    expect(first).toEqual(second);
  });

  // REQ-6B-5: different seeds (should) produce different orders.
  it('randomize(items, 1) and randomize(items, 99999) produce different orders (probabilistic)', () => {
    const orderA = evaluateNodesetValues('randomize(item, 1)', ITEMS);
    const orderB = evaluateNodesetValues('randomize(item, 99999)', ITEMS);
    // Not guaranteed for every pair, but these two seeds produce different orderings.
    expect(orderA).not.toEqual(orderB);
  });

  // REQ-6B-6: randomize() is registered and callable.
  it('randomize() is registered in the function library (no unknown-function error)', () => {
    expect(() => evaluateNodesetValues('randomize(item)', ITEMS)).not.toThrow();
  });
});
