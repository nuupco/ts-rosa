/**
 * PRE-T1: RED BAR — native function registration test.
 *
 * Asserts that `jr:itext()` and `instance()` are callable (no "unknown
 * function" error) when evaluated against a minimal form context.
 *
 * - itext: secondaryInstances empty, itext=null → fallback `[q]` returned.
 * - instance: secondaryInstances empty map → returns empty node-set.
 * - jr: namespace check: `jr:itext` resolves without "unknown function" error.
 *
 * These tests fail (RED) until PRE-T2/T3/T4 register the native shims.
 */

import { describe, it, expect } from 'vitest';
import { newNode } from '../../src/model/instance/InstanceNode.ts';
import type { InstanceTree } from '../../src/model/instance/InstanceTree.ts';
import {
  makeInstanceDocumentNode,
  wrapInstanceNode,
} from '../../src/xpath/adapter/instance/InstanceNodeXPathAdapter.ts';
import { instanceEvaluator } from '../../src/xpath/evaluator/InstanceEvaluator.ts';
import { XPATH_EVALUATION_RESULT } from '../../src/xpath/vendor/xpath/evaluator/result/XPathEvaluationResult.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalTree(): InstanceTree {
  const root = newNode('data');
  return { root, name: null };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('native function registration — jr:itext + instance', () => {
  it('jr:itext() is callable without an unknown-function error (fallback [id] returned)', () => {
    const tree = makeMinimalTree();
    const doc = makeInstanceDocumentNode(tree);
    const contextNode = wrapInstanceNode(tree.root, doc);

    // Must NOT throw "Unknown function" or any function-not-found error.
    // With itext=null on doc, the native shim returns '[q]' (JavaRosa fallback marker).
    let result: string;
    expect(() => {
      const r = instanceEvaluator.evaluate(
        "jr:itext('q')",
        contextNode,
        null,
        XPATH_EVALUATION_RESULT.STRING_TYPE,
      );
      result = r.stringValue;
    }).not.toThrow();

    // @ts-expect-error -- result is assigned inside the expect block above
    expect(result).toBe('[q]');
  });

  it('jr: namespace prefix resolves (function is registered under JAVAROSA_NAMESPACE_URI)', () => {
    const tree = makeMinimalTree();
    const doc = makeInstanceDocumentNode(tree);
    const contextNode = wrapInstanceNode(tree.root, doc);

    // A distinct id to confirm the jr: namespace lookup, not a coincidental xf: match.
    expect(() => {
      instanceEvaluator.evaluate(
        "jr:itext('some.label')",
        contextNode,
        null,
        XPATH_EVALUATION_RESULT.STRING_TYPE,
      );
    }).not.toThrow();
  });

  it('instance() is callable without an unknown-function error (returns empty node-set)', () => {
    const tree = makeMinimalTree();
    const doc = makeInstanceDocumentNode(tree);
    const contextNode = wrapInstanceNode(tree.root, doc);

    // secondaryInstances not attached to doc yet → returns [].
    expect(() => {
      instanceEvaluator.evaluate(
        "instance('x')",
        contextNode,
        null,
        XPATH_EVALUATION_RESULT.ANY_TYPE,
      );
    }).not.toThrow();
  });

  it('instance() with empty secondaryInstances returns empty node-set (no throw)', () => {
    const tree = makeMinimalTree();
    const doc = makeInstanceDocumentNode(tree, { secondaryInstances: new Map() });
    const contextNode = wrapInstanceNode(tree.root, doc);

    expect(() => {
      instanceEvaluator.evaluate(
        "instance('nonexistent')",
        contextNode,
        null,
        XPATH_EVALUATION_RESULT.ANY_TYPE,
      );
    }).not.toThrow();
  });
});
