/**
 * InstanceXPathNode — branded union types satisfying XPathNode constraints.
 *
 * These are thin wrappers over InstanceNode that provide the XPath 1.0 data
 * model (document, element, attribute, text) without modifying InstanceNode
 * itself (which stays pure, data-only, RN-friendly).
 *
 * Branding: each variant carries [XPathNodeKindKey] matching the string literal
 * that XmldomNode uses, so the union satisfies XPathNode at the type level.
 *
 * Identity stability: InstanceElementNode wrappers are cached in a WeakMap so
 * the same InstanceNode always produces the same wrapper object (===). This is
 * required for compareDocumentOrder and nodeset dedup inside the vendored
 * Evaluator. Attribute/text wrappers are transient (never compared ===
 * cross-call by the evaluator).
 */

import { XPathNodeKindKey } from '../../vendor/xpath/adapter/interface/XPathNode.ts';
import type { InstanceNode } from '../../../model/instance/InstanceNode.ts';
import type { InstanceTree } from '../../../model/instance/InstanceTree.ts';

// ---------------------------------------------------------------------------
// Document node — synthetic root wrapping the InstanceTree
// ---------------------------------------------------------------------------

/**
 * There is exactly ONE document node per evaluation. Its single child element
 * is the wrapper for tree.root. `node` is null because the document node has
 * no backing InstanceNode.
 */
export interface InstanceDocumentNode {
  readonly [XPathNodeKindKey]: 'document';
  readonly kind: 'document';
  readonly tree: InstanceTree;
  readonly node: null;
}

// ---------------------------------------------------------------------------
// Element node — 1:1 with an InstanceNode
// ---------------------------------------------------------------------------

export interface InstanceElementNode {
  readonly [XPathNodeKindKey]: 'element';
  readonly kind: 'element';
  readonly node: InstanceNode;
  readonly doc: InstanceDocumentNode;
}

// ---------------------------------------------------------------------------
// Attribute node — synthesized from InstanceNode.attributes entries
// ---------------------------------------------------------------------------

export interface InstanceAttributeNode {
  readonly [XPathNodeKindKey]: 'attribute';
  readonly kind: 'attribute';
  readonly owner: InstanceElementNode;
  readonly name: string;
  readonly value: string;
}

// ---------------------------------------------------------------------------
// Text node — synthesized leaf child carrying serialized value
// ---------------------------------------------------------------------------

export interface InstanceTextNode {
  readonly [XPathNodeKindKey]: 'text';
  readonly kind: 'text';
  readonly owner: InstanceElementNode;
  readonly value: string;
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export type InstanceXPathNode =
  | InstanceDocumentNode
  | InstanceElementNode
  | InstanceAttributeNode
  | InstanceTextNode;

// ---------------------------------------------------------------------------
// InstanceNodeWrapperCache — WeakMap for element identity stability
// ---------------------------------------------------------------------------

/**
 * Per-document cache mapping InstanceNode → InstanceElementNode.
 *
 * Keyed on InstanceNode (which is a plain object, GC-safe for WeakMap).
 * Each InstanceDocumentNode should own one cache so different evaluation
 * sessions (different InstanceTree instances) don't share wrappers.
 */
export type InstanceNodeWrapperCache = WeakMap<InstanceNode, InstanceElementNode>;

export function makeWrapperCache(): InstanceNodeWrapperCache {
  return new WeakMap<InstanceNode, InstanceElementNode>();
}
