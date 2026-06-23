/**
 * Node kind classification for xmldom nodes.
 *
 * Maps xmldom nodeType integers to XPathNodeKind strings.
 * xmlns:* attributes are classified as 'namespace_declaration' per XPath semantics.
 * No browser globals used — all constants are inlined.
 */

import type { XPathNodeKind } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { UnspecifiedNonXPathNodeKind } from '../vendor/xpath/adapter/interface/XPathNode.ts';

// Inlined to avoid importing from @getodk/common (which has no npm release).
const XMLNS_NAMESPACE_URI = 'http://www.w3.org/2000/xmlns/';

// nodeType constants (DOM Level 1) — inlined to avoid browser globals.
const DOCUMENT_NODE = 9;
const ELEMENT_NODE = 1;
const ATTRIBUTE_NODE = 2;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const COMMENT_NODE = 8;
const PROCESSING_INSTRUCTION_NODE = 7;
const DOCUMENT_TYPE_NODE = 10;

type XmldomNodeKind = XPathNodeKind | UnspecifiedNonXPathNodeKind;

/**
 * Returns the XPathNodeKind for a given xmldom node, or null if
 * the node is not a valid DOM Node object.
 */
/**
 * Structural check for xmldom nodes.
 *
 * We use duck-typing rather than instanceof to avoid importing @xmldom/xmldom
 * (a devDependency) into production src/ code. Plain objects with { nodeType: N }
 * are rejected because they lack the `lookupNamespaceURI` method that all
 * real xmldom Node instances expose.
 */
const isXmldomNodeObject = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const n = value as Record<string, unknown>;
  return (
    typeof n['nodeType'] === 'number' &&
    typeof n['lookupNamespaceURI'] === 'function'
  );
};

const getOptionalNodeKind = (value: unknown): XmldomNodeKind | null => {
  if (!isXmldomNodeObject(value)) {
    return null;
  }

  const node = value as { nodeType: number; namespaceURI?: string | null };


  switch (node.nodeType) {
    case DOCUMENT_NODE:
      return 'document';

    case DOCUMENT_TYPE_NODE:
      return 'UNSPECIFIED_NON_XPATH_NODE';

    case ELEMENT_NODE:
      return 'element';

    case ATTRIBUTE_NODE:
      return node.namespaceURI === XMLNS_NAMESPACE_URI
        ? 'namespace_declaration'
        : 'attribute';

    case TEXT_NODE:
    case CDATA_SECTION_NODE:
      return 'text';

    case COMMENT_NODE:
      return 'comment';

    case PROCESSING_INSTRUCTION_NODE:
      return 'processing_instruction';

    default:
      return null;
  }
};

export const getXmldomNodeKind = (node: object): XmldomNodeKind => {
  const kind = getOptionalNodeKind(node);
  if (kind == null) {
    throw new Error(
      `Unsupported xmldom node type: ${(node as { nodeType?: unknown }).nodeType}`
    );
  }
  return kind;
};

export const isXmldomNode = (value: unknown): boolean => {
  const kind = getOptionalNodeKind(value);
  return kind !== null && kind !== 'UNSPECIFIED_NON_XPATH_NODE';
};

export const isXmldomDocument = (node: object): boolean => {
  return (node as { nodeType?: number }).nodeType === DOCUMENT_NODE;
};

export const isXmldomElement = (node: object): boolean => {
  return (node as { nodeType?: number }).nodeType === ELEMENT_NODE;
};

export const isXmldomAttribute = (node: object): boolean => {
  const n = node as { nodeType?: number; namespaceURI?: string | null };
  return n.nodeType === ATTRIBUTE_NODE && n.namespaceURI !== XMLNS_NAMESPACE_URI;
};

export const isXmldomNamespaceDeclaration = (node: object): boolean => {
  const n = node as { nodeType?: number; namespaceURI?: string | null };
  return n.nodeType === ATTRIBUTE_NODE && n.namespaceURI === XMLNS_NAMESPACE_URI;
};

export const isXmldomParentNode = (node: object): boolean => {
  return isXmldomDocument(node) || isXmldomElement(node);
};
