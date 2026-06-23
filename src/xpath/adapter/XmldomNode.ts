/**
 * Branded xmldom node types that satisfy XPathNode constraints.
 *
 * Each variant extends the base xmldom-like structural interface and adds
 * the [XPathNodeKindKey] brand required by XPathDOMAdapter<T>.
 *
 * We do NOT import from @xmldom/xmldom (devDependency) — we use structural
 * typing with the minimal interface shapes that xmldom nodes satisfy.
 */

import { XPathNodeKindKey } from '@getodk/xpath';

// Minimal structural interfaces for xmldom node shapes.
// We avoid importing from @xmldom/xmldom to keep src/ free of devDependencies.

interface BaseNode {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly namespaceURI: string | null;
  readonly localName: string;
  readonly textContent: string | null;
  readonly nodeValue: string | null;
  readonly parentNode: BaseNode | null;
  readonly previousSibling: BaseNode | null;
  readonly nextSibling: BaseNode | null;
  readonly ownerDocument: XmldomDocument | null;
  childNodes: { length: number; item(i: number): BaseNode | null };
  attributes?: { length: number; item(i: number): BaseNode | null };
  ownerElement?: BaseNode | null;
  lookupNamespaceURI(prefix: string | null): string | null;
  compareDocumentPosition(other: BaseNode): number;
  contains?(other: BaseNode): boolean;
}

export interface XmldomDocument extends BaseNode {
  readonly [XPathNodeKindKey]: 'document';
  readonly nodeType: 9;
}

export interface XmldomElement extends BaseNode {
  readonly [XPathNodeKindKey]: 'element';
  readonly nodeType: 1;
}

export interface XmldomNamespaceDeclaration extends BaseNode {
  readonly [XPathNodeKindKey]: 'namespace_declaration';
  readonly nodeType: 2;
}

export interface XmldomAttribute extends BaseNode {
  readonly [XPathNodeKindKey]: 'attribute';
  readonly nodeType: 2;
}

export interface XmldomText extends BaseNode {
  readonly [XPathNodeKindKey]: 'text';
  readonly nodeType: 3 | 4;
}

export interface XmldomComment extends BaseNode {
  readonly [XPathNodeKindKey]: 'comment';
  readonly nodeType: 8;
}

export interface XmldomProcessingInstruction extends BaseNode {
  readonly [XPathNodeKindKey]: 'processing_instruction';
  readonly nodeType: 7;
}

export type XmldomNode =
  | XmldomDocument
  | XmldomElement
  | XmldomNamespaceDeclaration
  | XmldomAttribute
  | XmldomText
  | XmldomComment
  | XmldomProcessingInstruction;
