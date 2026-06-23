/**
 * Unit tests for XmldomXPathAdapter.
 *
 * Tests all ~20 adapter methods using @xmldom/xmldom node fixtures.
 * Written BEFORE implementation (red bar) per strict TDD protocol.
 *
 * T3 — these tests fail until T4 implements XmldomXPathAdapter.
 */

import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { xmldomXPathAdapter } from '../../../src/xpath/adapter/XmldomXPathAdapter.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
}

const NS_FOO = 'http://example.com/foo';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

const simpleDoc = parseXml('<root><a id="1">hello</a><b/><c/></root>');
const nsDoc = parseXml(
  '<foo:root xmlns:foo="http://example.com/foo"><foo:child/></foo:root>'
);
const piDoc = parseXml('<?target data?><root/>');
const commentDoc = parseXml('<root><!-- a comment --><child/></root>');
const cdataDoc = parseXml('<root><![CDATA[raw text]]></root>');

// Helper to get a node from the simple doc
const rootEl = simpleDoc.documentElement!;
const aEl = rootEl.childNodes[0] as Element;
const bEl = rootEl.childNodes[1] as Element;
const cEl = rootEl.childNodes[2] as Element;
const textNode = aEl.childNodes[0] as Text;
const attrNode = aEl.getAttributeNode('id')!;

// Namespace doc elements
const nsRootEl = nsDoc.documentElement!;
const nsChildEl = nsRootEl.childNodes[0] as Element;

// Comment and PI
const commentNode = commentDoc.documentElement!.childNodes[0]!;
const piDocEl = piDoc.documentElement!;

// ---------------------------------------------------------------------------
// isXPathNode / getNodeKind
// ---------------------------------------------------------------------------

describe('isXPathNode', () => {
  it('returns true for a Document', () => {
    expect(xmldomXPathAdapter.isXPathNode(simpleDoc)).toBe(true);
  });

  it('returns true for an Element', () => {
    expect(xmldomXPathAdapter.isXPathNode(rootEl)).toBe(true);
  });

  it('returns true for an Attr', () => {
    expect(xmldomXPathAdapter.isXPathNode(attrNode)).toBe(true);
  });

  it('returns true for a Text node', () => {
    expect(xmldomXPathAdapter.isXPathNode(textNode)).toBe(true);
  });

  it('returns false for null', () => {
    expect(xmldomXPathAdapter.isXPathNode(null)).toBe(false);
  });

  it('returns false for a plain object', () => {
    expect(xmldomXPathAdapter.isXPathNode({ nodeType: 1 })).toBe(false);
  });
});

describe('getNodeKind', () => {
  it('classifies document', () => {
    expect(xmldomXPathAdapter.getNodeKind(simpleDoc as any)).toBe('document');
  });

  it('classifies element', () => {
    expect(xmldomXPathAdapter.getNodeKind(rootEl as any)).toBe('element');
  });

  it('classifies attribute', () => {
    expect(xmldomXPathAdapter.getNodeKind(attrNode as any)).toBe('attribute');
  });

  it('classifies text', () => {
    expect(xmldomXPathAdapter.getNodeKind(textNode as any)).toBe('text');
  });

  it('classifies comment', () => {
    expect(xmldomXPathAdapter.getNodeKind(commentNode as any)).toBe('comment');
  });

  it('classifies xmlns attribute as namespace_declaration', () => {
    const xmlnsAttr = nsRootEl.getAttributeNodeNS(XMLNS_NS, 'foo')!;
    expect(xmldomXPathAdapter.getNodeKind(xmlnsAttr as any)).toBe('namespace_declaration');
  });

  it('classifies processing instruction', () => {
    const pi = piDoc.childNodes[0]!;
    expect(xmldomXPathAdapter.getNodeKind(pi as any)).toBe('processing_instruction');
  });
});

// ---------------------------------------------------------------------------
// Name adapter
// ---------------------------------------------------------------------------

describe('getLocalName', () => {
  it('returns local name for plain element', () => {
    expect(xmldomXPathAdapter.getLocalName(rootEl as any)).toBe('root');
  });

  it('returns local part for prefixed element', () => {
    expect(xmldomXPathAdapter.getLocalName(nsRootEl as any)).toBe('root');
  });

  it('returns local name for attribute', () => {
    expect(xmldomXPathAdapter.getLocalName(attrNode as any)).toBe('id');
  });
});

describe('getNamespaceURI', () => {
  it('returns null for non-namespaced element', () => {
    expect(xmldomXPathAdapter.getNamespaceURI(rootEl as any)).toBeNull();
  });

  it('returns namespace URI for prefixed element', () => {
    expect(xmldomXPathAdapter.getNamespaceURI(nsRootEl as any)).toBe(NS_FOO);
  });
});

describe('getQualifiedName', () => {
  it('returns nodeName for plain element', () => {
    expect(xmldomXPathAdapter.getQualifiedName(rootEl as any)).toBe('root');
  });

  it('returns prefixed name for namespaced element', () => {
    expect(xmldomXPathAdapter.getQualifiedName(nsRootEl as any)).toBe('foo:root');
  });
});

describe('getProcessingInstructionName', () => {
  it('returns target of PI', () => {
    const pi = piDoc.childNodes[0]!;
    expect(xmldomXPathAdapter.getProcessingInstructionName(pi as any)).toBe('target');
  });
});

describe('resolveNamespaceURI', () => {
  it('resolves declared prefix on element', () => {
    expect(xmldomXPathAdapter.resolveNamespaceURI(nsRootEl as any, 'foo')).toBe(NS_FOO);
  });

  it('returns null for unknown prefix', () => {
    expect(xmldomXPathAdapter.resolveNamespaceURI(rootEl as any, 'unknown')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Value adapter
// ---------------------------------------------------------------------------

describe('getNodeValue', () => {
  it('returns text content for text node', () => {
    expect(xmldomXPathAdapter.getNodeValue(textNode as any)).toBe('hello');
  });

  it('returns attribute value for attr', () => {
    expect(xmldomXPathAdapter.getNodeValue(attrNode as any)).toBe('1');
  });

  it('returns text content of element (all text descendants)', () => {
    expect(xmldomXPathAdapter.getNodeValue(aEl as any)).toBe('hello');
  });

  it('returns empty string for empty element', () => {
    expect(xmldomXPathAdapter.getNodeValue(bEl as any)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Traversal adapter
// ---------------------------------------------------------------------------

describe('getContainingDocument', () => {
  it('returns ownerDocument for element', () => {
    expect(xmldomXPathAdapter.getContainingDocument(rootEl as any)).toBe(simpleDoc);
  });

  it('returns itself for document', () => {
    expect(xmldomXPathAdapter.getContainingDocument(simpleDoc as any)).toBe(simpleDoc);
  });
});

describe('getParentNode', () => {
  it('returns parent element for child element', () => {
    expect(xmldomXPathAdapter.getParentNode(aEl as any)).toBe(rootEl);
  });

  it('returns document for root element', () => {
    expect(xmldomXPathAdapter.getParentNode(rootEl as any)).toBe(simpleDoc);
  });

  it('returns owner element for attribute', () => {
    expect(xmldomXPathAdapter.getParentNode(attrNode as any)).toBe(aEl);
  });

  it('returns null for document node', () => {
    expect(xmldomXPathAdapter.getParentNode(simpleDoc as any)).toBeNull();
  });
});

describe('getChildNodes', () => {
  it('returns children of element', () => {
    const children = xmldomXPathAdapter.getChildNodes(rootEl as any);
    expect(children).toHaveLength(3);
    expect(children[0]).toBe(aEl);
  });

  it('returns empty array for element with no children', () => {
    expect(xmldomXPathAdapter.getChildNodes(bEl as any)).toHaveLength(0);
  });

  it('returns empty array for attribute', () => {
    expect(xmldomXPathAdapter.getChildNodes(attrNode as any)).toHaveLength(0);
  });
});

describe('getChildElements', () => {
  it('returns only element children (excludes text nodes)', () => {
    const childEls = xmldomXPathAdapter.getChildElements(rootEl as any);
    expect(childEls).toHaveLength(3);
  });

  it('excludes text nodes from results', () => {
    // aEl has a text child, no element children
    expect(xmldomXPathAdapter.getChildElements(aEl as any)).toHaveLength(0);
  });
});

describe('getNamespaceDeclarations', () => {
  it('returns xmlns attributes as namespace_declaration nodes', () => {
    const decls = xmldomXPathAdapter.getNamespaceDeclarations(nsRootEl as any);
    expect(decls.length).toBeGreaterThan(0);
  });

  it('returns empty array for element with no namespace declarations', () => {
    expect(xmldomXPathAdapter.getNamespaceDeclarations(rootEl as any)).toHaveLength(0);
  });
});

describe('getAttributes', () => {
  it('returns non-xmlns attributes', () => {
    const attrs = xmldomXPathAdapter.getAttributes(aEl as any);
    expect(attrs).toHaveLength(1);
    expect((attrs[0] as Attr).name).toBe('id');
  });

  it('excludes xmlns declarations from attributes', () => {
    const attrs = xmldomXPathAdapter.getAttributes(nsRootEl as any);
    // xmlns:foo should not be in attributes
    for (const attr of attrs) {
      expect((attr as Attr).name).not.toMatch(/^xmlns/);
    }
  });

  it('returns empty array for element with no attributes', () => {
    expect(xmldomXPathAdapter.getAttributes(bEl as any)).toHaveLength(0);
  });
});

describe('getPreviousSiblingNode', () => {
  it('returns null for first child', () => {
    expect(xmldomXPathAdapter.getPreviousSiblingNode(aEl as any)).toBeNull();
  });

  it('returns previous sibling for non-first child', () => {
    expect(xmldomXPathAdapter.getPreviousSiblingNode(bEl as any)).toBe(aEl);
  });
});

describe('getNextSiblingNode', () => {
  it('returns next sibling element', () => {
    expect(xmldomXPathAdapter.getNextSiblingNode(aEl as any)).toBe(bEl);
  });

  it('returns null for last child', () => {
    expect(xmldomXPathAdapter.getNextSiblingNode(cEl as any)).toBeNull();
  });
});

describe('getPreviousSiblingElement', () => {
  it('returns null for first element', () => {
    expect(xmldomXPathAdapter.getPreviousSiblingElement(aEl as any)).toBeNull();
  });

  it('returns previous element sibling', () => {
    expect(xmldomXPathAdapter.getPreviousSiblingElement(bEl as any)).toBe(aEl);
  });
});

describe('getNextSiblingElement', () => {
  it('returns next element sibling', () => {
    expect(xmldomXPathAdapter.getNextSiblingElement(aEl as any)).toBe(bEl);
  });

  it('returns null for last element', () => {
    expect(xmldomXPathAdapter.getNextSiblingElement(cEl as any)).toBeNull();
  });
});

describe('compareDocumentOrder', () => {
  it('returns negative when A precedes B', () => {
    const result = xmldomXPathAdapter.compareDocumentOrder(aEl as any, cEl as any);
    expect(result).toBe(-1);
  });

  it('returns positive when A follows B', () => {
    const result = xmldomXPathAdapter.compareDocumentOrder(cEl as any, aEl as any);
    expect(result).toBe(1);
  });

  it('returns 0 for same node', () => {
    const result = xmldomXPathAdapter.compareDocumentOrder(aEl as any, aEl as any);
    expect(result).toBe(0);
  });
});

describe('isDescendantNode', () => {
  it('returns true for direct child', () => {
    expect(xmldomXPathAdapter.isDescendantNode(rootEl as any, aEl as any)).toBe(true);
  });

  it('returns true for deep descendant', () => {
    expect(xmldomXPathAdapter.isDescendantNode(simpleDoc as any, textNode as any)).toBe(true);
  });

  it('returns false for sibling', () => {
    expect(xmldomXPathAdapter.isDescendantNode(aEl as any, bEl as any)).toBe(false);
  });

  it('returns false for ancestor', () => {
    expect(xmldomXPathAdapter.isDescendantNode(aEl as any, rootEl as any)).toBe(false);
  });
});
