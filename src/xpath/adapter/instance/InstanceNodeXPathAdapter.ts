/**
 * InstanceNodeXPathAdapter — implements XPathDOMAdapter<InstanceXPathNode>
 * over ts-rosa's InstanceNode/InstanceTree.
 *
 * This is the Option A bridge: XPath evaluates directly over the InstanceTree
 * without any parallel xmldom DOM. The 225+ xmldom XPath tests are unaffected
 * because this adapter lives in a separate Evaluator<InstanceXPathNode> that
 * does not touch the XmldomXPathAdapter or its evaluator.
 *
 * Key design decisions (from design §1):
 * - Document-node is synthetic; NOT stored on InstanceNode.
 * - Element identity is cached in a WeakMap per document node.
 * - Attribute/text wrappers are transient (synthesized on demand).
 * - getChildElements filters INDEX_TEMPLATE nodes (invisible to XPath).
 * - compareDocumentOrder uses path-index vector walk (no DOM compareDocumentPosition).
 * - getNamespaceURI returns null (InstanceNode has no namespace tracking).
 * - getNodeValue uses answerValueToXPathString.
 * - relevanceOf closure: injected via InstanceEvaluationContext (default = always true).
 */

import type {
  XPathDOMAdapter,
  XPathNodeKind,
  UnspecifiedNonXPathNodeKind,
  DocumentOrderComparison,
  AdapterChildNode,
  AdapterDocument,
  AdapterElement,
  AdapterNode,
  AdapterAttribute,
  AdapterNamespaceDeclaration,
  AdapterQualifiedNamedNode,
} from '../../vendor/xpath/adapter/interface/XPathDOMAdapter.ts';
import type { AdapterProcessingInstruction } from '../../vendor/xpath/adapter/interface/XPathNodeKindAdapter.ts';
import { INDEX_TEMPLATE } from '../../../model/instance/multiplicity.ts';
import type { InstanceNode } from '../../../model/instance/InstanceNode.ts';
import type { InstanceTree } from '../../../model/instance/InstanceTree.ts';
import {
  type InstanceXPathNode,
  type InstanceDocumentNode,
  type InstanceElementNode,
  type InstanceAttributeNode,
  type InstanceTextNode,
  type InstanceNodeWrapperCache,
  makeWrapperCache,
} from './InstanceXPathNode.ts';
import { XPathNodeKindKey } from '../../vendor/xpath/adapter/interface/XPathNode.ts';
import { answerValueToXPathString } from './answerValueToXPathString.ts';

// ---------------------------------------------------------------------------
// Factory: create document node (one per evaluation session)
// ---------------------------------------------------------------------------

/** Per-document WeakMap caches — keyed by InstanceDocumentNode. */
const documentCaches = new WeakMap<InstanceDocumentNode, InstanceNodeWrapperCache>();

/**
 * Create the synthetic document node for an InstanceTree.
 *
 * Each call returns a NEW document node (callers should cache this at the
 * FormEvaluator / session level for a stable session root).
 */
export function makeInstanceDocumentNode(tree: InstanceTree): InstanceDocumentNode {
  const doc: InstanceDocumentNode = {
    [XPathNodeKindKey]: 'document',
    kind: 'document',
    tree,
    node: null,
  };
  documentCaches.set(doc, makeWrapperCache());
  return doc;
}

/**
 * Wrap an InstanceNode as an InstanceElementNode, using the per-document cache
 * to guarantee identity stability (same InstanceNode → same wrapper ===).
 */
export function wrapInstanceNode(
  node: InstanceNode,
  doc: InstanceDocumentNode,
): InstanceElementNode {
  const cache = documentCaches.get(doc);
  if (cache === undefined) {
    throw new Error('Document node has no wrapper cache — was it created via makeInstanceDocumentNode?');
  }
  const existing = cache.get(node);
  if (existing !== undefined) {
    return existing;
  }
  const wrapper: InstanceElementNode = {
    [XPathNodeKindKey]: 'element',
    kind: 'element',
    node,
    doc,
  };
  cache.set(node, wrapper);
  return wrapper;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getDoc(n: InstanceXPathNode): InstanceDocumentNode {
  switch (n.kind) {
    case 'document':
      return n;
    case 'element':
      return n.doc;
    case 'attribute':
      return n.owner.doc;
    case 'text':
      return n.owner.doc;
  }
}

function getParentElement(n: InstanceElementNode): InstanceElementNode | null {
  const parent = n.node.parent;
  if (parent === null) return null;
  return wrapInstanceNode(parent, n.doc);
}

/**
 * Emit a synthetic text child for a leaf element (no child elements, has value).
 */
function syntheticTextChild(
  el: InstanceElementNode,
  value: string,
): InstanceTextNode {
  return {
    [XPathNodeKindKey]: 'text',
    kind: 'text',
    owner: el,
    value,
  };
}

/**
 * Get the XPath string-value of an element: for leaf elements (no non-template
 * children) serialize own value; for interior elements concatenate descendant
 * leaf string-values (XPath string-value rule).
 */
function getElementStringValue(el: InstanceElementNode): string {
  const realChildren = el.node.children.filter(
    (c) => c.multiplicity !== INDEX_TEMPLATE,
  );
  if (realChildren.length === 0) {
    // Leaf node
    return answerValueToXPathString(el.node.value);
  }
  // Interior: concatenate descendant leaf values
  return realChildren
    .map((child) => getElementStringValue(wrapInstanceNode(child, el.doc)))
    .join('');
}

/**
 * Build the path-index vector for document-order comparison.
 * Returns an array of integers: [root-index, level1-index, ...].
 * Document node gets an empty vector (precedes everything).
 */
function pathIndexVector(n: InstanceXPathNode): number[] {
  switch (n.kind) {
    case 'document':
      return [];
    case 'element': {
      // Walk from root to this node collecting child index at each level
      const indices: number[] = [];
      let current: InstanceElementNode | null = n;
      while (current !== null) {
        const parent = getParentElement(current);
        if (parent === null) {
          // This is the root element; doc's child index is always 0
          indices.unshift(0);
        } else {
          const realChildren = parent.node.children.filter(
            (c) => c.multiplicity !== INDEX_TEMPLATE,
          );
          const idx = realChildren.indexOf(current.node);
          indices.unshift(idx < 0 ? 0 : idx);
        }
        current = parent;
      }
      return indices;
    }
    case 'attribute': {
      // Attributes follow their element; use element vector + large offset
      const ownerVec = pathIndexVector(n.owner);
      const attrKeys = Array.from(n.owner.node.attributes.keys());
      const attrIdx = attrKeys.indexOf(n.name);
      return [...ownerVec, 1_000_000 + (attrIdx < 0 ? 0 : attrIdx)];
    }
    case 'text': {
      // Text follows attributes
      const ownerVec = pathIndexVector(n.owner);
      return [...ownerVec, 2_000_000];
    }
  }
}

function compareVectors(a: number[], b: number[]): DocumentOrderComparison {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

export const instanceNodeXPathAdapter: XPathDOMAdapter<InstanceXPathNode> = {
  // -------------------------------------------------------------------------
  // XPathNodeKindAdapter
  // -------------------------------------------------------------------------

  isXPathNode(value: unknown): value is InstanceXPathNode {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string | symbol, unknown>;
    const kind = v['kind'];
    return (
      kind === 'document' ||
      kind === 'element' ||
      kind === 'attribute' ||
      kind === 'text'
    );
  },

  getNodeKind(node: InstanceXPathNode): XPathNodeKind | UnspecifiedNonXPathNodeKind {
    return node.kind;
  },

  // -------------------------------------------------------------------------
  // XPathNameAdapter
  // -------------------------------------------------------------------------

  getNamespaceURI(
    node: AdapterQualifiedNamedNode<InstanceXPathNode>,
  ): string | null {
    // InstanceNode has no namespace tracking; always null
    return null;
  },

  getQualifiedName(
    node: AdapterQualifiedNamedNode<InstanceXPathNode>,
  ): string {
    const n = node as InstanceXPathNode;
    if (n.kind === 'element') return n.node.name;
    if (n.kind === 'attribute') return n.name;
    return '';
  },

  getLocalName(
    node: AdapterQualifiedNamedNode<InstanceXPathNode>,
  ): string {
    const n = node as InstanceXPathNode;
    if (n.kind === 'element') {
      // Strip any prefix (none expected in instance names, but be safe)
      const name = n.node.name;
      const colon = name.indexOf(':');
      return colon >= 0 ? name.slice(colon + 1) : name;
    }
    if (n.kind === 'attribute') {
      const colon = n.name.indexOf(':');
      return colon >= 0 ? n.name.slice(colon + 1) : n.name;
    }
    return '';
  },

  getProcessingInstructionName(
    _node: AdapterProcessingInstruction<InstanceXPathNode>,
  ): string {
    // No PI nodes in InstanceTree
    throw new Error('InstanceNodeXPathAdapter: processing instructions are not supported');
  },

  resolveNamespaceURI(
    _node: InstanceXPathNode,
    _prefix: string | null,
  ): string | null {
    // No namespace declarations in InstanceTree
    return null;
  },

  // -------------------------------------------------------------------------
  // XPathValueAdapter
  // -------------------------------------------------------------------------

  getNodeValue(node: InstanceXPathNode): string {
    switch (node.kind) {
      case 'document': {
        // String-value of document = string-value of root element
        const rootWrapper = wrapInstanceNode(node.tree.root, node);
        return getElementStringValue(rootWrapper);
      }
      case 'element':
        return getElementStringValue(node);
      case 'attribute':
        return node.value;
      case 'text':
        return node.value;
    }
  },

  // -------------------------------------------------------------------------
  // XPathTraversalAdapter
  // -------------------------------------------------------------------------

  getContainingDocument(
    node: InstanceXPathNode,
  ): AdapterDocument<InstanceXPathNode> {
    return getDoc(node) as AdapterDocument<InstanceXPathNode>;
  },

  getNamespaceDeclarations(
    _node: InstanceXPathNode,
  ): readonly AdapterNamespaceDeclaration<InstanceXPathNode>[] {
    return [];
  },

  getAttributes(
    node: InstanceXPathNode,
  ): readonly AdapterAttribute<InstanceXPathNode>[] {
    if (node.kind !== 'element') return [];
    const result: InstanceAttributeNode[] = [];
    for (const [name, value] of node.node.attributes) {
      result.push({
        [XPathNodeKindKey]: 'attribute',
        kind: 'attribute',
        owner: node,
        name,
        value,
      });
    }
    return result as readonly AdapterAttribute<InstanceXPathNode>[];
  },

  getParentNode(
    node: InstanceXPathNode,
  ): AdapterNode<InstanceXPathNode> | null {
    switch (node.kind) {
      case 'document':
        return null;
      case 'element': {
        if (node.node.parent === null) {
          // Root element's parent is the document node
          return node.doc as AdapterNode<InstanceXPathNode>;
        }
        return wrapInstanceNode(node.node.parent, node.doc) as AdapterNode<InstanceXPathNode>;
      }
      case 'attribute':
        return node.owner as AdapterNode<InstanceXPathNode>;
      case 'text':
        return node.owner as AdapterNode<InstanceXPathNode>;
    }
  },

  getChildNodes(
    node: InstanceXPathNode,
  ): readonly AdapterChildNode<InstanceXPathNode>[] {
    switch (node.kind) {
      case 'document': {
        const rootWrapper = wrapInstanceNode(node.tree.root, node);
        return [rootWrapper] as readonly AdapterChildNode<InstanceXPathNode>[];
      }
      case 'element': {
        const realChildren = node.node.children.filter(
          (c) => c.multiplicity !== INDEX_TEMPLATE,
        );
        const result: AdapterChildNode<InstanceXPathNode>[] = [];
        if (realChildren.length === 0) {
          // Leaf: emit synthetic text child if value non-null
          const strVal = answerValueToXPathString(node.node.value);
          if (strVal !== '') {
            result.push(syntheticTextChild(node, strVal) as AdapterChildNode<InstanceXPathNode>);
          }
        } else {
          for (const child of realChildren) {
            result.push(
              wrapInstanceNode(child, node.doc) as AdapterChildNode<InstanceXPathNode>,
            );
          }
        }
        return result;
      }
      case 'attribute':
      case 'text':
        return [];
    }
  },

  getChildElements(
    node: InstanceXPathNode,
  ): readonly AdapterElement<InstanceXPathNode>[] {
    switch (node.kind) {
      case 'document': {
        const rootWrapper = wrapInstanceNode(node.tree.root, node);
        return [rootWrapper] as readonly AdapterElement<InstanceXPathNode>[];
      }
      case 'element': {
        const realChildren = node.node.children.filter(
          (c) => c.multiplicity !== INDEX_TEMPLATE,
        );
        return realChildren.map(
          (c) => wrapInstanceNode(c, node.doc) as AdapterElement<InstanceXPathNode>,
        );
      }
      case 'attribute':
      case 'text':
        return [];
    }
  },

  getPreviousSiblingNode(
    node: InstanceXPathNode,
  ): AdapterChildNode<InstanceXPathNode> | null {
    if (node.kind !== 'element') return null;
    const parent = node.node.parent;
    if (parent === null) return null;
    const realChildren = parent.children.filter(
      (c) => c.multiplicity !== INDEX_TEMPLATE,
    );
    const idx = realChildren.indexOf(node.node);
    if (idx <= 0) return null;
    const prev = realChildren[idx - 1];
    if (prev === undefined) return null;
    return wrapInstanceNode(prev, node.doc) as AdapterChildNode<InstanceXPathNode>;
  },

  getPreviousSiblingElement(
    node: InstanceXPathNode,
  ): AdapterElement<InstanceXPathNode> | null {
    // Same as getPreviousSiblingNode for InstanceTree (only elements as siblings)
    return instanceNodeXPathAdapter.getPreviousSiblingNode(node) as AdapterElement<InstanceXPathNode> | null;
  },

  getNextSiblingNode(
    node: InstanceXPathNode,
  ): AdapterChildNode<InstanceXPathNode> | null {
    if (node.kind !== 'element') return null;
    const parent = node.node.parent;
    if (parent === null) return null;
    const realChildren = parent.children.filter(
      (c) => c.multiplicity !== INDEX_TEMPLATE,
    );
    const idx = realChildren.indexOf(node.node);
    if (idx < 0 || idx >= realChildren.length - 1) return null;
    const next = realChildren[idx + 1];
    if (next === undefined) return null;
    return wrapInstanceNode(next, node.doc) as AdapterChildNode<InstanceXPathNode>;
  },

  getNextSiblingElement(
    node: InstanceXPathNode,
  ): AdapterElement<InstanceXPathNode> | null {
    return instanceNodeXPathAdapter.getNextSiblingNode(node) as AdapterElement<InstanceXPathNode> | null;
  },

  compareDocumentOrder(
    a: InstanceXPathNode,
    b: InstanceXPathNode,
  ): DocumentOrderComparison {
    if (a === b) return 0;
    return compareVectors(pathIndexVector(a), pathIndexVector(b));
  },

  isDescendantNode(
    ancestor: InstanceXPathNode,
    node: InstanceXPathNode,
  ): boolean {
    if (ancestor.kind === 'attribute' || ancestor.kind === 'text') return false;

    // Walk node's parent chain
    let current: InstanceXPathNode | null = instanceNodeXPathAdapter.getParentNode(node);
    while (current !== null) {
      if (current === ancestor) return true;
      current = instanceNodeXPathAdapter.getParentNode(current);
    }
    return false;
  },
};
