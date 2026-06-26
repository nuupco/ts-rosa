/**
 * handlers.ts — body element dispatch for XFormParser.
 *
 * Each handler converts a DOM Element to a FormElement.
 * All DOM access uses localName (never nodeName/tagName) to handle
 * namespace-prefixed documents correctly.
 */

import type { FormElement, ChoiceItem, ItemsetDef } from '../model/def/FormElement.ts';
import type { DataBinding } from '../model/def/DataBinding.ts';
import { controlTypeFromTag } from '../model/def/controlType.ts';
import { parseAbsoluteRef } from '../model/instance/TreeReference.ts';
import { childElementsByLocalName, firstByLocalName, textContent, labelInnerText } from './domHelpers.ts';

/** Build context passed to each handler */
export type BuildCtx = {
  readonly bindings: ReadonlyMap<string, DataBinding>;
};

export type BodyHandler = (el: Element, ctx: BuildCtx) => FormElement;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLabelText(el: Element): string | null {
  const labelEl = firstByLocalName(el, 'label');
  return labelEl ? textContent(labelEl) : null;
}

function getHintText(el: Element): string | null {
  const hintEl = firstByLocalName(el, 'hint');
  return hintEl ? textContent(hintEl) : null;
}
const ITEXT_REF_RE = /jr:itext\(\s*['"]([^'"]+)['"]\s*\)/;

function getChoices(el: Element): readonly ChoiceItem[] {
  return childElementsByLocalName(el, 'item').map((itemEl) => {
    const valueEl = firstByLocalName(itemEl, 'value');
    const labelEl = firstByLocalName(itemEl, 'label');

    if (labelEl !== null) {
      const refAttr = labelEl.getAttribute('ref');
      if (refAttr !== null) {
        // <label ref="jr:itext('id')"/> — itext-driven label
        const match = ITEXT_REF_RE.exec(refAttr);
        if (match !== null) {
          return {
            value: valueEl ? (textContent(valueEl) ?? '') : '',
            labelText: null,
            labelIsItext: true,
            labelItextId: match[1] ?? null,
          };
        }
        // Other ref expressions — not yet supported for static items; fall through
      }
    }

    return {
      value: valueEl ? (textContent(valueEl) ?? '') : '',
      labelText: labelEl ? textContent(labelEl) : null,
    };
  });
}

/**
 * Parse an <itemset nodeset="..."> child of a select/select1 element.
 * Returns an ItemsetDef, or null if no <itemset> child is present.
 *
 * <itemset nodeset="expr">
 *   <value ref="..."/>
 *   <label ref="..."/>     (or <label ref="jr:itext(...)"/>)
 * </itemset>
 */
function getItemset(el: Element): ItemsetDef | null {
  const itemsetEl = firstByLocalName(el, 'itemset');
  if (itemsetEl === null) return null;

  const nodesetExpr = itemsetEl.getAttribute('nodeset') ?? '';
  if (nodesetExpr === '') {
    // Malformed itemset — warn but do not throw (per task spec)
    return null;
  }

  const valueEl = firstByLocalName(itemsetEl, 'value');
  const labelEl = firstByLocalName(itemsetEl, 'label');

  const valueExpr = valueEl?.getAttribute('ref') ?? '';
  const rawLabelRef = labelEl?.getAttribute('ref') ?? '';

  // Detect jr:itext() label reference
  const itextMatch = ITEXT_REF_RE.exec(rawLabelRef);
  const labelIsItext = itextMatch !== null || /jr:itext\(/.test(rawLabelRef);

  // For dynamic itext (id is an XPath expr, not a string literal): labelItextId = null
  // For static itext: labelItextId = the extracted id string
  const labelItextId = itextMatch !== null ? (itextMatch[1] ?? null) : null;

  // labelExpr: for itext labels, keep the full ref for runtime resolution;
  // for plain labels, it is the relative XPath to evaluate per node.
  const labelExpr = rawLabelRef !== '' ? rawLabelRef : 'label';

  return { nodesetExpr, valueExpr, labelExpr, labelIsItext, labelItextId };
}

/**
 * Build FormElement children from DOM child elements.
 * Used both at body top-level (buildBodyElements) and recursively for group/repeat children.
 *
 * Applies transparent group flattening (JR compat): a <group ref="/data/X"> that
 * directly wraps a <repeat nodeset="/data/X"> with the SAME ref is a JR idiom for
 * labeling the repeat (both map to a single GroupDef in JR but are distinct kinds
 * in ts-rosa). Flattening avoids an extra GROUP stop and the double-extended ref
 * /data/X/X that would otherwise appear during navigation.
 */
export function buildFormElements(parentEl: Element, ctx: BuildCtx): readonly FormElement[] {
  const elements: FormElement[] = [];
  const childEls = childElementsByLocalName(parentEl, '*');
  for (const childEl of childEls) {
    const tag = childEl.localName ?? '';
    if (tag === 'group') {
      const groupRef = childEl.getAttribute('ref') ?? childEl.getAttribute('nodeset') ?? '';
      const repeatChildren = childElementsByLocalName(childEl, 'repeat');
      if (repeatChildren.length === 1 && repeatChildren[0] !== undefined) {
        const repeatRef = repeatChildren[0].getAttribute('nodeset') ?? repeatChildren[0].getAttribute('ref') ?? '';
        if (groupRef !== '' && groupRef === repeatRef) {
          // Transparent group: promote its children directly
          const promoted = buildFormElements(childEl, ctx);
          elements.push(...promoted);
          continue;
        }
      }
    }
    const handler = handlers.get(tag);
    if (handler) {
      elements.push(handler(childEl, ctx));
    }
    // Unknown tags are skipped silently
  }
  return elements;
}

function buildChildren(el: Element, ctx: BuildCtx): readonly FormElement[] {
  return buildFormElements(el, ctx);
}

// ---------------------------------------------------------------------------
// Question handler (input, select1, select, trigger, upload)
// ---------------------------------------------------------------------------

function questionHandler(el: Element, ctx: BuildCtx): FormElement {
  const refAttr = el.getAttribute('ref') ?? '';
  const ref = parseAbsoluteRef(refAttr);
  const controlType = controlTypeFromTag(el.localName ?? '');
  const binding = ctx.bindings.get(refAttr) ?? null;
  const labelEl = firstByLocalName(el, 'label');
  const labelText = labelEl ? textContent(labelEl) : null;
  const innerText = labelEl ? labelInnerText(labelEl) : null;
  const itemset = getItemset(el);
  // When itemset is present, choices = [] (itemset takes precedence)
  const choices = itemset !== null ? [] : getChoices(el);
  const appearance = el.getAttribute('appearance') ?? null;
  const mediatype = el.getAttribute('mediatype') ?? null;
  const hintText = getHintText(el);

  return { kind: 'question', ref, controlType, binding, labelText, labelInnerText: innerText, choices, itemset, appearance, mediatype, hintText };
}

// ---------------------------------------------------------------------------
// Group handler
// ---------------------------------------------------------------------------

function groupHandler(el: Element, ctx: BuildCtx): FormElement {
  const refAttr = el.getAttribute('ref') ?? el.getAttribute('nodeset') ?? '';
  const ref = parseAbsoluteRef(refAttr);
  const labelText = getLabelText(el);
  const children = buildChildren(el, ctx);
  const appearance = el.getAttribute('appearance') ?? null;
  const hintText = getHintText(el);
  return { kind: 'group', ref, labelText, children, appearance, hintText };
}

// ---------------------------------------------------------------------------
// Repeat handler
// ---------------------------------------------------------------------------

function repeatHandler(el: Element, ctx: BuildCtx): FormElement {
  const refAttr = el.getAttribute('nodeset') ?? el.getAttribute('ref') ?? '';
  const ref = parseAbsoluteRef(refAttr);
  const labelText = getLabelText(el);
  const children = buildChildren(el, ctx);
  // jr:count — XPath expression controlling how many instances to auto-create.
  // Attribute is in the jr: namespace; xmldom preserves the prefix when xmlns:jr is declared.
  // Fall back to localName 'count' (without prefix) for robustness.
  const countExpr = el.getAttribute('jr:count') ?? el.getAttribute('count') ?? null;
  const hintText = getHintText(el);
  return { kind: 'repeat', ref, labelText, children, countExpr, hintText };
}

// ---------------------------------------------------------------------------
// Handler map
// ---------------------------------------------------------------------------

const handlers: Map<string, BodyHandler> = new Map([
  ['input', questionHandler],
  ['select1', questionHandler],
  ['select', questionHandler],
  ['trigger', questionHandler],
  ['upload', questionHandler],
  ['range', questionHandler],
  ['secret', questionHandler],
  ['group', groupHandler],
  ['repeat', repeatHandler],
]);

export const bodyHandlers: ReadonlyMap<string, BodyHandler> = handlers;
