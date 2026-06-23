/**
 * XFormParser — 4-step pure pipeline for XForms parsing.
 *
 * Step 1: Walk <instance> DOM → build InstanceTree
 * Step 2: Parse <bind> elements → build DataBinding map (XPATH FIREWALL)
 * Step 3: Parse <body> children → build FormElement tree
 * Step 4: applyBindings (second pure pass) → set dataType + cast values on InstanceNodes
 */

import type { FormDefinition } from '../model/def/FormDefinition.ts';
import type { InstanceNode } from '../model/instance/InstanceNode.ts';
import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import type { DataBinding } from '../model/def/DataBinding.ts';
import type { FormElement } from '../model/def/FormElement.ts';
import { newNode, appendChild } from '../model/instance/InstanceNode.ts';
import { resolveReference } from '../model/instance/InstanceTree.ts';
import { INDEX_TEMPLATE } from '../model/instance/multiplicity.ts';
import { cast } from '../model/data/codecs.ts';
import { getXmlParser } from '../platform/XmlParser.ts';
import { bindProcessor } from './bindProcessor.ts';
import { bodyHandlers } from './handlers.ts';
import { childElementsByLocalName, firstByLocalName, directTextContent, textContent } from './domHelpers.ts';

// ---------------------------------------------------------------------------
// Step 1: Build InstanceTree from <instance> element
// ---------------------------------------------------------------------------

/** Internal: raw text holder before applyBindings casts it */
const RAW_TEXT_ATTR = '__rawText';

function buildInstanceNode(el: Element): InstanceNode {
  const node = newNode(el.localName ?? el.nodeName);

  // Copy non-namespace attributes
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr && !attr.name.startsWith('xmlns')) {
      node.attributes.set(attr.name, attr.value);
    }
  }

  // Check if this is a repeat template (jr:template attribute)
  const isTemplate =
    el.getAttribute('jr:template') !== null ||
    el.localName === 'repeat';
  if (isTemplate) {
    node.multiplicity = INDEX_TEMPLATE;
  }

  // Walk child nodes
  let hasElementChildren = false;
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    if (child.nodeType === 1 /* ELEMENT_NODE */) {
      hasElementChildren = true;
      appendChild(node, buildInstanceNode(child as Element));
    }
  }

  // Leaf node: capture raw text for later casting in applyBindings
  if (!hasElementChildren) {
    const raw = directTextContent(el);
    if (raw !== null) {
      // Store raw text in attributes map for retrieval in applyBindings
      node.attributes.set(RAW_TEXT_ATTR, raw);
    }
  }

  return node;
}

function buildInstanceTree(instanceEl: Element): InstanceTree {
  // The instance element may wrap the actual data root element
  const childEls = childElementsByLocalName(instanceEl, '*');
  if (childEls.length === 0) {
    // Empty instance: create a placeholder root
    return { root: newNode('instance'), name: null };
  }
  const dataRoot = childEls[0]!;
  const root = buildInstanceNode(dataRoot);
  const instanceId = instanceEl.getAttribute('id') ?? null;
  return { root, name: instanceId };
}

// ---------------------------------------------------------------------------
// Step 4: Apply bindings (second pure pass)
// ---------------------------------------------------------------------------

function applyBindingsToNode(node: InstanceNode, bindings: ReadonlyMap<string, DataBinding>, path: string): void {
  const currentPath = `${path}/${node.name}`;

  // Find binding by nodeset path
  const binding = bindings.get(currentPath);
  if (binding) {
    node.dataType = binding.dataType;
    // Cast raw text to typed AnswerValue
    const rawText = node.attributes.get(RAW_TEXT_ATTR);
    if (rawText !== undefined) {
      node.value = cast(binding.dataType, rawText) ?? null;
      node.attributes.delete(RAW_TEXT_ATTR);
    }
  } else {
    // Clean up raw text attribute for unbound nodes — keep as string AnswerValue
    const rawText = node.attributes.get(RAW_TEXT_ATTR);
    if (rawText !== undefined) {
      node.value = cast('string', rawText) ?? null;
      node.attributes.delete(RAW_TEXT_ATTR);
    }
  }

  // Recurse into children
  for (const child of node.children) {
    applyBindingsToNode(child, bindings, currentPath);
  }
}

function applyBindings(tree: InstanceTree, bindings: ReadonlyMap<string, DataBinding>): void {
  // The root path segment is the root node's name
  applyBindingsToNode(tree.root, bindings, '');
}

// ---------------------------------------------------------------------------
// Step 3: Build body FormElements
// ---------------------------------------------------------------------------

function buildBody(bodyEl: Element, bindings: ReadonlyMap<string, DataBinding>): readonly FormElement[] {
  const ctx = { bindings };
  const elements: FormElement[] = [];
  const childEls = childElementsByLocalName(bodyEl, '*');
  for (const childEl of childEls) {
    const tag = childEl.localName ?? '';
    const handler = bodyHandlers.get(tag);
    if (handler) {
      elements.push(handler(childEl, ctx));
    }
    // Unknown tags silently skipped
  }
  return elements;
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

function extractTitle(doc: Document): string | null {
  // Look for h:title or title under h:head/head
  const headEl =
    firstDocumentElementByLocalName(doc, 'head') ??
    firstDocumentElementByLocalName(doc, 'html')
      ? findByLocalNameDeep(doc.documentElement!, 'head')
      : null;

  if (!headEl) return null;
  const titleEl = firstByLocalName(headEl, 'title');
  return titleEl ? textContent(titleEl) : null;
}

function firstDocumentElementByLocalName(doc: Document, localName: string): Element | null {
  const root = doc.documentElement;
  if (!root) return null;
  if (root.localName === localName) return root;
  return firstByLocalName(root, localName);
}

function findByLocalNameDeep(el: Element, localName: string): Element | null {
  if (el.localName === localName) return el;
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1) {
      const found = findByLocalNameDeep(child as Element, localName);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * parseDocument — seam-free. Accepts a pre-parsed W3C Document.
 * All 4 pipeline steps run here.
 */
export function parseDocument(doc: Document): FormDefinition {
  const root = doc.documentElement;
  if (!root) {
    return { title: null, mainInstance: { root: newNode('data'), name: null }, bindings: new Map(), body: [] };
  }

  // Find model (under h:head/head)
  const headEl = findByLocalNameDeep(root, 'head');
  const modelEl = headEl ? findByLocalNameDeep(headEl, 'model') : null;

  // Step 1: Find primary <instance> (first instance child of model)
  const instanceEl = modelEl ? firstByLocalName(modelEl, 'instance') : null;
  const mainInstance: InstanceTree = instanceEl
    ? buildInstanceTree(instanceEl)
    : { root: newNode('data'), name: null };

  // Step 2: bindProcessor — find all <bind> children of model
  const bindEls = modelEl
    ? (childElementsByLocalName(modelEl, 'bind') as Element[])
    : [];
  const bindings = bindProcessor(bindEls);

  // Step 3: Find body (h:body or body)
  const bodyEl = findByLocalNameDeep(root, 'body');
  const body: readonly FormElement[] = bodyEl ? buildBody(bodyEl, bindings) : [];

  // Step 4: applyBindings — second pure pass
  applyBindings(mainInstance, bindings);

  // Title
  const title = extractTitle(doc);

  return { title, mainInstance, bindings, body };
}

/**
 * parseForm — entry point that uses the registered XmlParser seam.
 */
export function parseForm(xml: string): FormDefinition {
  const doc = getXmlParser().parse(xml);
  return parseDocument(doc);
}
