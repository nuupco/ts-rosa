/**
 * XmldomXPathAdapter — implements XPathDOMAdapter<XmldomNode> over @xmldom/xmldom.
 *
 * This adapter is the bridge between @getodk/xpath's generic Evaluator and the
 * xmldom DOM tree produced by the XmlParser seam. It has NO browser DOM globals
 * and does NOT import @xmldom/xmldom (a devDependency) into production src/.
 *
 * All ~20 required methods are assembled here from the sub-modules:
 *   XmldomNode.ts  — branded node types satisfying XPathNode constraints
 *   kind.ts        — nodeType → XPathNodeKind mapping
 *   names.ts       — local/ns/qualified name resolution
 *   values.ts      — getNodeValue (textContent / nodeValue)
 *   traversal.ts   — parent / children / siblings / document order
 */

import type {
  XPathDOMAdapter,
  XPathNodeKind,
  UnspecifiedNonXPathNodeKind,
  DocumentOrderComparison,
} from '@getodk/xpath';
import type {
  AdapterChildNode,
  AdapterDocument,
  AdapterElement,
  AdapterNode,
  AdapterAttribute,
  AdapterNamespaceDeclaration,
} from '@getodk/xpath';
import type {
  XmldomAttribute,
  XmldomDocument,
  XmldomElement,
  XmldomNamespaceDeclaration,
  XmldomNode,
  XmldomProcessingInstruction,
} from './XmldomNode.ts';
import {
  getXmldomNodeKind,
  isXmldomNode,
} from './kind.ts';
import {
  getXmldomLocalName,
  getXmldomNamespaceURI,
  getXmldomProcessingInstructionName,
  getXmldomQualifiedName,
  resolveXmldomNamespaceURI,
} from './names.ts';
import {
  compareXmldomDocumentOrder,
  getXmldomAttributes,
  getXmldomChildElements,
  getXmldomChildNodes,
  getXmldomContainingDocument,
  getXmldomNamespaceDeclarations,
  getXmldomNextSiblingElement,
  getXmldomNextSiblingNode,
  getXmldomParentNode,
  getXmldomPreviousSiblingElement,
  getXmldomPreviousSiblingNode,
  isXmldomDescendantNode,
} from './traversal.ts';
import { getXmldomNodeValue } from './values.ts';

export type { XmldomNode } from './XmldomNode.ts';

/**
 * Singleton adapter instance typed as XPathDOMAdapter<XmldomNode>.
 *
 * At runtime, callers pass actual @xmldom/xmldom Node objects; the branded
 * XmldomNode type is a structural type that xmldom nodes satisfy at runtime,
 * even though the XPathNodeKindKey symbol brand is not present at the type level
 * on raw DOM nodes. The `as unknown as` cast here is safe because:
 *
 * 1. isXPathNode() validates that only real xmldom nodes (with lookupNamespaceURI)
 *    are accepted.
 * 2. All adapter methods operate via duck-typing, never accessing XPathNodeKindKey.
 */
export const xmldomXPathAdapter: XPathDOMAdapter<XmldomNode> = {
  // -------------------------------------------------------------------------
  // XPathNodeKindAdapter
  // -------------------------------------------------------------------------

  isXPathNode(value: unknown): value is XmldomNode {
    return isXmldomNode(value);
  },

  getNodeKind(node: XmldomNode): XPathNodeKind | UnspecifiedNonXPathNodeKind {
    return getXmldomNodeKind(node as object);
  },

  // -------------------------------------------------------------------------
  // XPathNameAdapter
  // -------------------------------------------------------------------------

  getNamespaceURI(node: XmldomElement | XmldomAttribute): string | null {
    return getXmldomNamespaceURI(node as { nodeName: string; namespaceURI: string | null; localName: string });
  },

  getQualifiedName(node: XmldomElement | XmldomAttribute): string {
    return getXmldomQualifiedName(node as { nodeName: string; namespaceURI: string | null });
  },

  getLocalName(node: XmldomElement | XmldomAttribute): string {
    return getXmldomLocalName(node as { nodeName: string; namespaceURI: string | null; localName: string });
  },

  getProcessingInstructionName(node: XmldomProcessingInstruction): string {
    return getXmldomProcessingInstructionName(node as { nodeName: string });
  },

  resolveNamespaceURI(node: XmldomNode, prefix: string | null): string | null {
    return resolveXmldomNamespaceURI(
      node as { lookupNamespaceURI(prefix: string | null): string | null },
      prefix
    );
  },

  // -------------------------------------------------------------------------
  // XPathValueAdapter
  // -------------------------------------------------------------------------

  getNodeValue(node: XmldomNode): string {
    return getXmldomNodeValue(node as { textContent?: string | null; nodeValue?: string | null });
  },

  // -------------------------------------------------------------------------
  // XPathTraversalAdapter
  // -------------------------------------------------------------------------

  getContainingDocument(node: XmldomNode): AdapterDocument<XmldomNode> {
    return getXmldomContainingDocument(node as object) as AdapterDocument<XmldomNode>;
  },

  getNamespaceDeclarations(node: XmldomNode): readonly AdapterNamespaceDeclaration<XmldomNode>[] {
    return getXmldomNamespaceDeclarations(node as object) as readonly AdapterNamespaceDeclaration<XmldomNode>[];
  },

  getAttributes(node: XmldomNode): readonly AdapterAttribute<XmldomNode>[] {
    return getXmldomAttributes(node as object) as readonly AdapterAttribute<XmldomNode>[];
  },

  getParentNode(node: XmldomNode): AdapterNode<XmldomNode> | null {
    return getXmldomParentNode(node as object) as AdapterNode<XmldomNode> | null;
  },

  getChildNodes(node: XmldomNode): readonly AdapterChildNode<XmldomNode>[] {
    return getXmldomChildNodes(node as object) as readonly AdapterChildNode<XmldomNode>[];
  },

  getChildElements(node: XmldomNode): readonly AdapterElement<XmldomNode>[] {
    return getXmldomChildElements(node as object) as readonly AdapterElement<XmldomNode>[];
  },

  getPreviousSiblingNode(node: XmldomNode): AdapterChildNode<XmldomNode> | null {
    return getXmldomPreviousSiblingNode(node as object) as AdapterChildNode<XmldomNode> | null;
  },

  getPreviousSiblingElement(node: XmldomNode): AdapterElement<XmldomNode> | null {
    return getXmldomPreviousSiblingElement(node as object) as AdapterElement<XmldomNode> | null;
  },

  getNextSiblingNode(node: XmldomNode): AdapterChildNode<XmldomNode> | null {
    return getXmldomNextSiblingNode(node as object) as AdapterChildNode<XmldomNode> | null;
  },

  getNextSiblingElement(node: XmldomNode): AdapterElement<XmldomNode> | null {
    return getXmldomNextSiblingElement(node as object) as AdapterElement<XmldomNode> | null;
  },

  compareDocumentOrder(a: XmldomNode, b: XmldomNode): DocumentOrderComparison {
    return compareXmldomDocumentOrder(a as object, b as object);
  },

  isDescendantNode(ancestor: XmldomNode, node: XmldomNode): boolean {
    return isXmldomDescendantNode(ancestor as object, node as object);
  },
};
