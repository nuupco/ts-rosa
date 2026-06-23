/**
 * domHelpers — pure DOM utilities for the XForms parser.
 *
 * RULE: Never match by nodeName/tagName. Always use localName to handle
 * namespace prefixes (e.g. h:body, h:head) correctly with @xmldom/xmldom.
 */

/**
 * Returns direct child Elements whose localName matches the given name.
 * '*' returns all direct child elements.
 */
export function childElementsByLocalName(parent: Element | Document, localName: string): Element[] {
  const results: Element[] = [];
  const children = parent.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1 /* ELEMENT_NODE */) {
      const el = child as Element;
      if (localName === '*' || el.localName === localName) {
        results.push(el);
      }
    }
  }
  return results;
}

/**
 * Returns the first direct child Element with the given localName, or null.
 */
export function firstByLocalName(parent: Element | Document, localName: string): Element | null {
  const children = parent.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1 /* ELEMENT_NODE */) {
      const el = child as Element;
      if (el.localName === localName) {
        return el;
      }
    }
  }
  return null;
}

/**
 * Returns the concatenated text content of direct Text node children, trimmed.
 * Returns null if empty.
 */
export function directTextContent(el: Element): string | null {
  let text = '';
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 3 /* TEXT_NODE */) {
      text += child.nodeValue ?? '';
    }
  }
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Deep text content of an element (all descendant text nodes), trimmed.
 * Returns null if empty.
 */
export function textContent(el: Element): string | null {
  const text = (el.textContent ?? '').trim();
  return text === '' ? null : text;
}
