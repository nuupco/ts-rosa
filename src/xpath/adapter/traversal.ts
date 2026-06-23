/**
 * Traversal adapter for xmldom nodes.
 *
 * Implements all XPathTraversalAdapter methods without browser globals.
 * xmldom does not expose previousElementSibling / nextElementSibling,
 * so those are built via sibling-node iteration.
 */

import type { DocumentOrderComparison } from '@getodk/xpath';
import { isXmldomDocument, isXmldomElement, isXmldomAttribute, isXmldomNamespaceDeclaration, isXmldomParentNode } from './kind.ts';

// Minimal structural types to avoid importing from @xmldom/xmldom directly
// (the adapter operates on opaque DOM objects; we cast as needed).
type AnyNode = object;

const ELEMENT_NODE = 1;

// ---------------------------------------------------------------------------
// Document containment
// ---------------------------------------------------------------------------

export const getXmldomContainingDocument = (node: AnyNode): AnyNode => {
  if (isXmldomDocument(node)) {
    return node;
  }
  const n = node as { ownerDocument?: AnyNode | null };
  const doc = n.ownerDocument;
  if (doc == null) {
    throw new Error('xmldom node has no ownerDocument');
  }
  return doc;
};

// ---------------------------------------------------------------------------
// Namespace declarations and attributes
// ---------------------------------------------------------------------------

const getAttrs = (node: AnyNode): readonly AnyNode[] => {
  if (!isXmldomElement(node)) {
    return [];
  }
  const el = node as { attributes?: { length: number; item(i: number): AnyNode | null } };
  if (el.attributes == null) {
    return [];
  }
  const result: AnyNode[] = [];
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes.item(i);
    if (attr != null) {
      result.push(attr);
    }
  }
  return result;
};

export const getXmldomNamespaceDeclarations = (node: AnyNode): readonly AnyNode[] => {
  return getAttrs(node).filter(isXmldomNamespaceDeclaration);
};

export const getXmldomAttributes = (node: AnyNode): readonly AnyNode[] => {
  return getAttrs(node).filter(isXmldomAttribute);
};

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

export const getXmldomParentNode = (node: AnyNode): AnyNode | null => {
  // Attributes have ownerElement as their logical parent
  if (isXmldomAttribute(node) || isXmldomNamespaceDeclaration(node)) {
    const attr = node as { ownerElement?: AnyNode | null };
    return attr.ownerElement ?? null;
  }
  const n = node as { parentNode?: AnyNode | null };
  return n.parentNode ?? null;
};

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

export const getXmldomChildNodes = (node: AnyNode): readonly AnyNode[] => {
  if (!isXmldomParentNode(node)) {
    return [];
  }
  const n = node as { childNodes?: { length: number; item(i: number): AnyNode | null } };
  if (n.childNodes == null) {
    return [];
  }
  const result: AnyNode[] = [];
  for (let i = 0; i < n.childNodes.length; i++) {
    const child = n.childNodes.item(i);
    if (child != null) {
      result.push(child);
    }
  }
  return result;
};

export const getXmldomChildElements = (node: AnyNode): readonly AnyNode[] => {
  return getXmldomChildNodes(node).filter(isXmldomElement);
};

// ---------------------------------------------------------------------------
// Siblings (xmldom does not expose previousElementSibling/nextElementSibling)
// ---------------------------------------------------------------------------

export const getXmldomPreviousSiblingNode = (node: AnyNode): AnyNode | null => {
  const n = node as { previousSibling?: AnyNode | null };
  return n.previousSibling ?? null;
};

export const getXmldomNextSiblingNode = (node: AnyNode): AnyNode | null => {
  const n = node as { nextSibling?: AnyNode | null };
  return n.nextSibling ?? null;
};

export const getXmldomPreviousSiblingElement = (node: AnyNode): AnyNode | null => {
  let sibling = getXmldomPreviousSiblingNode(node);
  while (sibling != null) {
    if (isXmldomElement(sibling)) {
      return sibling;
    }
    sibling = getXmldomPreviousSiblingNode(sibling);
  }
  return null;
};

export const getXmldomNextSiblingElement = (node: AnyNode): AnyNode | null => {
  let sibling = getXmldomNextSiblingNode(node);
  while (sibling != null) {
    if (isXmldomElement(sibling)) {
      return sibling;
    }
    sibling = getXmldomNextSiblingNode(sibling);
  }
  return null;
};

// ---------------------------------------------------------------------------
// Document order comparison
// ---------------------------------------------------------------------------

const DOCUMENT_POSITION_PRECEDING = 0x02;
const DOCUMENT_POSITION_FOLLOWING = 0x04;

// For attributes, compareDocumentPosition must be called on the owner element.
const getComparableNode = (node: AnyNode): AnyNode => {
  if (isXmldomAttribute(node) || isXmldomNamespaceDeclaration(node)) {
    const attr = node as { ownerElement?: AnyNode | null };
    return attr.ownerElement ?? node;
  }
  return node;
};

export const compareXmldomDocumentOrder = (a: AnyNode, b: AnyNode): DocumentOrderComparison => {
  if (a === b) {
    return 0;
  }

  const ca = getComparableNode(a);
  const cb = getComparableNode(b);

  if (ca === cb) {
    // Both attrs on the same element: attribute order is document order
    // Return 0 as stable fallback (attr vs attr same element)
    return 0;
  }

  const nodeB = cb as { compareDocumentPosition(other: object): number };
  const compared = nodeB.compareDocumentPosition(ca);

  if (compared & DOCUMENT_POSITION_FOLLOWING) {
    return 1;
  }

  if (compared & DOCUMENT_POSITION_PRECEDING) {
    return -1;
  }

  // Fallback: jsdom-style edge case where compareDocumentPosition returns 0
  // for same-tree nodes (a known xmldom quirk for adjacent nodes).
  // Try the reverse comparison to disambiguate.
  const nodeA = ca as { compareDocumentPosition(other: object): number };
  const reversed = nodeA.compareDocumentPosition(cb);

  if (reversed & DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }

  if (reversed & DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }

  throw new Error('Failed to compare document position');
};

// ---------------------------------------------------------------------------
// Descendant check
// ---------------------------------------------------------------------------

export const isXmldomDescendantNode = (ancestor: AnyNode, node: AnyNode): boolean => {
  const a = ancestor as { contains?(other: object): boolean };
  if (typeof a.contains === 'function') {
    return a.contains(node);
  }
  // Fallback: walk up the tree
  let current: AnyNode | null = getXmldomParentNode(node);
  while (current != null) {
    if (current === ancestor) {
      return true;
    }
    current = getXmldomParentNode(current);
  }
  return false;
};
