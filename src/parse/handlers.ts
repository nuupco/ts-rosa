/**
 * handlers.ts — body element dispatch for XFormParser.
 *
 * Each handler converts a DOM Element to a FormElement.
 * All DOM access uses localName (never nodeName/tagName) to handle
 * namespace-prefixed documents correctly.
 */

import type { FormElement, ChoiceItem } from '../model/def/FormElement.ts';
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

function getChoices(el: Element): readonly ChoiceItem[] {
  return childElementsByLocalName(el, 'item').map((itemEl) => {
    const valueEl = firstByLocalName(itemEl, 'value');
    const labelEl = firstByLocalName(itemEl, 'label');
    return {
      value: valueEl ? (textContent(valueEl) ?? '') : '',
      labelText: labelEl ? textContent(labelEl) : null,
    };
  });
}

function buildChildren(el: Element, ctx: BuildCtx): readonly FormElement[] {
  const children: FormElement[] = [];
  const childEls = childElementsByLocalName(el, '*');
  for (const childEl of childEls) {
    const tag = childEl.localName ?? '';
    const handler = handlers.get(tag);
    if (handler) {
      children.push(handler(childEl, ctx));
    }
    // Unknown tags are skipped silently (diagnostic could be recorded here)
  }
  return children;
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
  const choices = getChoices(el);

  return { kind: 'question', ref, controlType, binding, labelText, labelInnerText: innerText, choices };
}

// ---------------------------------------------------------------------------
// Group handler
// ---------------------------------------------------------------------------

function groupHandler(el: Element, ctx: BuildCtx): FormElement {
  const refAttr = el.getAttribute('ref') ?? el.getAttribute('nodeset') ?? '';
  const ref = parseAbsoluteRef(refAttr);
  const labelText = getLabelText(el);
  const children = buildChildren(el, ctx);
  return { kind: 'group', ref, labelText, children };
}

// ---------------------------------------------------------------------------
// Repeat handler
// ---------------------------------------------------------------------------

function repeatHandler(el: Element, ctx: BuildCtx): FormElement {
  const refAttr = el.getAttribute('nodeset') ?? el.getAttribute('ref') ?? '';
  const ref = parseAbsoluteRef(refAttr);
  const labelText = getLabelText(el);
  const children = buildChildren(el, ctx);
  return { kind: 'repeat', ref, labelText, children };
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
  ['group', groupHandler],
  ['repeat', repeatHandler],
]);

export const bodyHandlers: ReadonlyMap<string, BodyHandler> = handlers;
