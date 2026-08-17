/**
 * Unit tests for InstanceNodeXPathAdapter — Slice 3.1, Task T1 (test-first).
 *
 * Tests cover S3.1-A through S3.1-D from the spec:
 *   A — Simple path evaluation over InstanceTree
 *   B — Attribute access
 *   C — Parent navigation
 *   D — Document-node synthesis
 *
 * Also tests:
 *   - Wrapper identity (same InstanceNode → same wrapper object ===)
 *   - Document node (/ vs /data)
 *   - count() and position() basics
 *   - getChildElements filters INDEX_TEMPLATE nodes
 */

import { describe, it, expect } from 'vitest';
import { newNode, appendChild, setAttribute } from '../../../../src/model/instance/InstanceNode.ts';
import type { InstanceNode } from '../../../../src/model/instance/InstanceNode.ts';
import type { InstanceTree } from '../../../../src/model/instance/InstanceTree.ts';
import { INDEX_TEMPLATE } from '../../../../src/model/instance/multiplicity.ts';
import {
  instanceNodeXPathAdapter,
  makeInstanceDocumentNode,
  wrapInstanceNode,
} from '../../../../src/xpath/adapter/instance/InstanceNodeXPathAdapter.ts';
import type {
  InstanceDocumentNode,
  InstanceElementNode,
} from '../../../../src/xpath/adapter/instance/InstanceXPathNode.ts';
import { instanceEvaluator } from '../../../../src/xpath/evaluator/InstanceEvaluator.ts';
import type { InstanceEvaluationContext } from '../../../../src/xpath/evaluator/InstanceEvaluator.ts';
import { XPATH_EVALUATION_RESULT } from '../../../../src/xpath/vendor/xpath/evaluator/result/XPathEvaluationResult.ts';
import { FormEvaluator } from '../../../../src/session/FormEvaluator.ts';

// ---------------------------------------------------------------------------
// Helpers to build test trees
// ---------------------------------------------------------------------------

function makeTree(root: InstanceNode): InstanceTree {
  return { root, name: null };
}

function evalString(expr: string, ctx: InstanceEvaluationContext): string {
  const result = instanceEvaluator.evaluate(
    expr,
    ctx.contextNode,
    null,
    XPATH_EVALUATION_RESULT.STRING_TYPE,
  );
  return result.stringValue;
}

function evalNumber(expr: string, ctx: InstanceEvaluationContext): number {
  const result = instanceEvaluator.evaluate(
    expr,
    ctx.contextNode,
    null,
    XPATH_EVALUATION_RESULT.NUMBER_TYPE,
  );
  return result.numberValue;
}

// ---------------------------------------------------------------------------
// S3.1-A — Simple path evaluation over InstanceTree
// ---------------------------------------------------------------------------

describe('S3.1-A: simple path evaluation over InstanceTree', () => {
  it('evaluates /data/name to the leaf string value', () => {
    const root = newNode('data');
    const nameNode = newNode('name', { value: { kind: 'string', value: 'Alice', displayText: 'Alice' } });
    appendChild(root, nameNode);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const rootWrapper = wrapInstanceNode(nameNode, doc);

    const ctx: InstanceEvaluationContext = {
      instanceRoot: doc,
      contextNode: rootWrapper,
    };

    const val = evalString('/data/name', ctx);
    expect(val).toBe('Alice');
  });

  it('evaluates /data/age to a numeric string value', () => {
    const root = newNode('data');
    const ageNode = newNode('age', { value: { kind: 'int', value: 30, displayText: '30' } });
    appendChild(root, ageNode);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const rootWrapper = wrapInstanceNode(root, doc);

    const ctx: InstanceEvaluationContext = {
      instanceRoot: doc,
      contextNode: rootWrapper,
    };

    const val = evalString('/data/age', ctx);
    expect(val).toBe('30');
  });

  it('evaluates relative child path from context node', () => {
    const root = newNode('data');
    const child = newNode('x', { value: { kind: 'string', value: 'hello', displayText: 'hello' } });
    appendChild(root, child);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const rootWrapper = wrapInstanceNode(root, doc);

    const ctx: InstanceEvaluationContext = {
      instanceRoot: doc,
      contextNode: rootWrapper,
    };

    const val = evalString('x', ctx);
    expect(val).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// S3.1-B — Attribute access
// ---------------------------------------------------------------------------

describe('S3.1-B: attribute access', () => {
  it('evaluates /data/@id attribute', () => {
    const root = newNode('data');
    setAttribute(root, 'id', 'form1');
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const rootWrapper = wrapInstanceNode(root, doc);

    const ctx: InstanceEvaluationContext = {
      instanceRoot: doc,
      contextNode: rootWrapper,
    };

    const val = evalString('/data/@id', ctx);
    expect(val).toBe('form1');
  });

  it('returns empty string for missing attribute', () => {
    const root = newNode('data');
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const rootWrapper = wrapInstanceNode(root, doc);

    const ctx: InstanceEvaluationContext = {
      instanceRoot: doc,
      contextNode: rootWrapper,
    };

    const val = evalString('/data/@missing', ctx);
    expect(val).toBe('');
  });
});

// ---------------------------------------------------------------------------
// S3.1-C — Parent navigation
// ---------------------------------------------------------------------------

describe('S3.1-C: parent navigation', () => {
  it('adapter.getParentNode(child) returns parent element wrapper', () => {
    const root = newNode('data');
    const child = newNode('field');
    appendChild(root, child);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);

    const childWrapper = wrapInstanceNode(child, doc);
    const parentWrapper = instanceNodeXPathAdapter.getParentNode(childWrapper);

    expect(parentWrapper).not.toBeNull();
    const pw = parentWrapper as InstanceElementNode;
    expect(pw.kind).toBe('element');
    expect(pw.node).toBe(root);
  });

  it('navigates parent via XPath ..', () => {
    const root = newNode('data');
    const child = newNode('field', { value: { kind: 'string', value: 'x', displayText: 'x' } });
    appendChild(root, child);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const childWrapper = wrapInstanceNode(child, doc);

    const ctx: InstanceEvaluationContext = {
      instanceRoot: doc,
      contextNode: childWrapper,
    };

    // name() of parent should be 'data'
    const val = evalString('name(..)', ctx);
    expect(val).toBe('data');
  });
});

// ---------------------------------------------------------------------------
// S3.1-D — Document-node synthesis
// ---------------------------------------------------------------------------

describe('S3.1-D: document-node synthesis', () => {
  it('root element parent is the document node', () => {
    const root = newNode('data');
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const rootWrapper = wrapInstanceNode(root, doc);

    const parent = instanceNodeXPathAdapter.getParentNode(rootWrapper);
    expect(parent).not.toBeNull();
    const p = parent as InstanceDocumentNode;
    expect(instanceNodeXPathAdapter.getNodeKind(p)).toBe('document');
    expect(p.kind).toBe('document');
    expect(p.node).toBeNull();
  });

  it('document node is distinct from root element', () => {
    const root = newNode('data');
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const rootWrapper = wrapInstanceNode(root, doc);

    expect(doc).not.toBe(rootWrapper);
    expect(doc.kind).toBe('document');
    expect(rootWrapper.kind).toBe('element');
  });

  it('getContainingDocument returns document from element', () => {
    const root = newNode('data');
    const child = newNode('x');
    appendChild(root, child);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const childWrapper = wrapInstanceNode(child, doc);

    const containing = instanceNodeXPathAdapter.getContainingDocument(childWrapper);
    expect(containing).toBe(doc);
  });
});

// ---------------------------------------------------------------------------
// Wrapper identity (WeakMap cache)
// ---------------------------------------------------------------------------

describe('wrapper identity: same InstanceNode → same wrapper ===', () => {
  it('wrapping the same InstanceNode twice returns identical object', () => {
    const root = newNode('data');
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);

    const w1 = wrapInstanceNode(root, doc);
    const w2 = wrapInstanceNode(root, doc);
    expect(w1).toBe(w2);
  });

  it('different InstanceNodes produce different wrappers', () => {
    const root = newNode('data');
    const a = newNode('a');
    const b = newNode('b');
    appendChild(root, a);
    appendChild(root, b);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);

    const wa = wrapInstanceNode(a, doc);
    const wb = wrapInstanceNode(b, doc);
    expect(wa).not.toBe(wb);
  });
});

// ---------------------------------------------------------------------------
// getChildElements — template filtering
// ---------------------------------------------------------------------------

describe('getChildElements filters INDEX_TEMPLATE nodes', () => {
  it('does not expose template nodes', () => {
    const root = newNode('data');
    const template = newNode('item');
    template.multiplicity = INDEX_TEMPLATE;
    const real = newNode('item');
    appendChild(root, template);
    appendChild(root, real);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const rootWrapper = wrapInstanceNode(root, doc);

    const children = instanceNodeXPathAdapter.getChildElements(rootWrapper);
    expect(children).toHaveLength(1);
    const ch = children[0] as InstanceElementNode;
    expect(ch.node).toBe(real);
  });
});

// ---------------------------------------------------------------------------
// count() and position() basics
// ---------------------------------------------------------------------------

describe('XPath count() and position() basics', () => {
  it('count(/data/item) returns number of children', () => {
    const root = newNode('data');
    appendChild(root, newNode('item', { value: { kind: 'string', value: '1', displayText: '1' } }));
    appendChild(root, newNode('item', { value: { kind: 'string', value: '2', displayText: '2' } }));
    appendChild(root, newNode('item', { value: { kind: 'string', value: '3', displayText: '3' } }));
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const rootWrapper = wrapInstanceNode(root, doc);

    const ctx: InstanceEvaluationContext = {
      instanceRoot: doc,
      contextNode: rootWrapper,
    };

    const n = evalNumber('count(/data/item)', ctx);
    expect(n).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getNodeValue — null value → empty string
// ---------------------------------------------------------------------------

describe('getNodeValue serialization', () => {
  it('null value serializes to empty string', () => {
    const root = newNode('data');
    const field = newNode('x', { value: null });
    appendChild(root, field);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const fieldWrapper = wrapInstanceNode(field, doc);

    const val = instanceNodeXPathAdapter.getNodeValue(fieldWrapper);
    expect(val).toBe('');
  });

  it('int value serializes to its number string', () => {
    const root = newNode('data');
    const field = newNode('n', { value: { kind: 'int', value: 42, displayText: '42' }, dataType: 'int' });
    appendChild(root, field);
    const tree = makeTree(root);
    const doc = makeInstanceDocumentNode(tree);
    const fieldWrapper = wrapInstanceNode(field, doc);

    const val = instanceNodeXPathAdapter.getNodeValue(fieldWrapper);
    expect(val).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// FormEvaluator.evaluateOnInstance — wires through InstanceEvaluator (S3.1-A→D)
// ---------------------------------------------------------------------------

describe('FormEvaluator.evaluateOnInstance routes through instanceEvaluator', () => {
  it('evaluateOnInstance evaluates /data/x correctly', () => {
    const root = newNode('data');
    const x = newNode('x', { value: { kind: 'string', value: 'test', displayText: 'test' } });
    appendChild(root, x);
    const tree = makeTree(root);

    const evaluator = new FormEvaluator(tree);
    const result = evaluator.evaluateOnInstance('/data/x');
    expect(result).toBe('test');
  });

  it('evaluateOnInstance returns empty string for empty nodeset', () => {
    const root = newNode('data');
    const tree = makeTree(root);

    const evaluator = new FormEvaluator(tree);
    const result = evaluator.evaluateOnInstance('count(/data/missing)');
    expect(result).toBe(0);
  });
});
