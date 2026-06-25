/**
 * InstanceSerializer — serialize an InstanceTree to ODK-submission XML.
 *
 * Mirrors JavaRosa XFormSerializingVisitor.serializeNode behavior:
 *   - Skip INDEX_TEMPLATE nodes (JR line 179)
 *   - Skip non-relevant nodes (JR line 179)
 *   - Leaf: emit <name attrs>uncast(value)</name>, or self-closing <name/> when empty (ADR-3)
 *   - Container: en-bloc child grouping (JR 207-224), attributes in Map insertion order
 *
 * ADR-1 (CRITICAL): leaf values are serialized via uncast() from codecs.ts —
 * the submission WIRE format, NOT answerValueToXPathString.
 *   boolean → "1"/"0"   (not "true"/"false")
 *   decimal → "1.0"     (Java Double.toString, not bare integer)
 *
 * ADR-3: empty leaf emits self-closing <name/> (kXML compatible).
 *
 * Namespace emission is OUT OF SCOPE (R3) — ts-rosa InstanceNode has no
 * separate namespace field; forms round-tripped through ts-rosa fold ns
 * into names/attrs already.
 *
 * Slice 6a — serialization-odk-functions
 */

import { uncast } from '../data/codecs.ts';
import type { InstanceNode } from './InstanceNode.ts';
import { INDEX_TEMPLATE } from './multiplicity.ts';
import type { InstanceTree } from './InstanceTree.ts';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SerializeOptions {
  /**
   * Per-node relevance predicate. When omitted, all nodes are treated as
   * relevant (pure structure serialization).
   */
  readonly isRelevant?: (node: InstanceNode) => boolean;
}

/**
 * Serialize an InstanceTree to ODK-submission XML.
 * No XML declaration is emitted (mirrors JavaRosa XFormSerializingVisitor).
 */
export function serializeInstance(tree: InstanceTree, opts?: SerializeOptions): string {
  const isRelevant = opts?.isRelevant ?? (() => true);
  return serializeNode(tree.root, isRelevant) ?? '';
}

// ---------------------------------------------------------------------------
// XML escaping helpers
// ---------------------------------------------------------------------------

/** Escape text content: & < >  (do NOT escape quotes — not required in text). */
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escape attribute value (double-quoted): & < > "  */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Attribute serialization
// ---------------------------------------------------------------------------

function serializeAttrs(attrs: Map<string, string>): string {
  if (attrs.size === 0) return '';
  const parts: string[] = [];
  for (const [key, val] of attrs) {
    parts.push(` ${key}="${escapeAttr(val)}"`);
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Core traversal
// ---------------------------------------------------------------------------

/**
 * Serialize a single node and its descendants.
 * Returns null when the node must be skipped (template or non-relevant).
 */
function serializeNode(
  node: InstanceNode,
  isRelevant: (n: InstanceNode) => boolean,
): string | null {
  // Skip rule (mirrors JR XFormSerializingVisitor.serializeNode line 179)
  if (node.multiplicity === INDEX_TEMPLATE) return null;
  if (!isRelevant(node)) return null;

  const attrs = serializeAttrs(node.attributes);

  // LEAF: has a value (including null — null means empty element, REQ-6A-7)
  if (node.children.length === 0) {
    if (node.value === null) {
      // ADR-3: self-closing for empty element
      return `<${node.name}${attrs}/>`;
    }
    const text = escapeText(uncast(node.value));
    if (text === '') {
      // ADR-3: empty string value → self-closing
      return `<${node.name}${attrs}/>`;
    }
    return `<${node.name}${attrs}>${text}</${node.name}>`;
  }

  // CONTAINER: en-bloc child grouping (JR 207-224)
  // Build ordered unique child-name list in document order.
  const seenNames = new Set<string>();
  const orderedNames: string[] = [];
  for (const child of node.children) {
    if (!seenNames.has(child.name)) {
      seenNames.add(child.name);
      orderedNames.push(child.name);
    }
  }

  let childContent = '';
  for (const childName of orderedNames) {
    for (const child of node.children) {
      if (child.name !== childName) continue;
      const serialized = serializeNode(child, isRelevant);
      if (serialized !== null) {
        childContent += serialized;
      }
    }
  }

  return `<${node.name}${attrs}>${childContent}</${node.name}>`;
}
