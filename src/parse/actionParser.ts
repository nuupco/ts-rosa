/**
 * actionParser — parses `<setvalue>` action elements (model-level and
 * body-nested) into `SetValueAction` records.
 *
 * Kept separate from handlers.ts (FormElement production) per design
 * doc "sdd/setvalue-actions/design" section "Integration points".
 *
 * Scope (v1, this module):
 *   - Recognizes `<setvalue event="..." ref="..." value="...">` (attribute
 *     value) or `<setvalue event="..." ref="...">inner text</setvalue>`.
 *   - Fails loud (throws) on:
 *       - missing/unsupported `event` attribute value
 *       - missing `ref` attribute
 *       - a `ref` that would require repeat-relative resolution (v1 limit —
 *         only absolute and simple host-relative single targets are
 *         supported; see `resolveTargetRef`)
 *   - Does NOT wire actions into TriggerableDag (separate ActionRegistry,
 *     a later PR).
 */

import { compileInstanceXPath } from '../xpath/seam/XPathSeam.ts';
import { getTriggers } from '../eval/getTriggers.ts';
import { PureJSExpressionParser } from '../xpath/parser/PureJSExpressionParser.ts';
import { normalizeEvent, type SetValueAction } from '../eval/SetValueAction.ts';
import { parseAbsoluteRef, type TreeReference } from '../model/instance/TreeReference.ts';
import { directTextContent } from './domHelpers.ts';

const sharedParser = new PureJSExpressionParser();

/**
 * Resolves a `<setvalue ref="...">` attribute to an absolute TreeReference.
 *
 * v1 scope: only absolute refs (starting with '/') and simple host-relative
 * refs (a bare relative path, no `..` parent navigation, resolved as a child
 * of the host control's own ref) are supported. Anything else
 * (relative refs with no host context, or refs using `..` navigation) would
 * require repeat-instance-aware resolution that FormDefinition — a static,
 * parse-time record — cannot express, so it is rejected fail-loud.
 */
function resolveTargetRef(rawRef: string, hostRef: TreeReference | null, sourceLocation: string): TreeReference {
  if (rawRef.startsWith('/')) {
    return parseAbsoluteRef(rawRef);
  }

  if (rawRef.includes('..')) {
    throw new Error(
      `setvalue: repeat-relative target ref '${rawRef}' is not supported (${sourceLocation}). ` +
        "Only absolute (starting with '/') or simple host-relative refs are supported in v1.",
    );
  }

  if (hostRef === null) {
    throw new Error(
      `setvalue: relative target ref '${rawRef}' has no host control context to resolve against (${sourceLocation}). ` +
        "Model-level setvalue actions must use an absolute ref (starting with '/').",
    );
  }

  // Host-relative: resolve by appending the relative segments to the host's
  // own path (standard XForms/XPath relative-path semantics evaluate a
  // relative ref against the context node itself, i.e. as a child of the
  // host, not a sibling of it — no repeat-instance resolution needed for a
  // bare path).
  const hostPath = hostRef.levels.map((lvl) => lvl.name).join('/');
  const base = hostPath.length > 0 ? `/${hostPath}` : '';
  return parseAbsoluteRef(`${base}/${rawRef}`);
}

/**
 * Parses a single `<setvalue>` DOM element into a `SetValueAction`.
 *
 * @param el - the `<setvalue>` element.
 * @param hostRef - absolute ref of the enclosing control (body-nested case),
 *   or null for model-level setvalue elements.
 */
export function parseSetValueAction(el: Element, hostRef: TreeReference | null): SetValueAction {
  const rawEvent = el.getAttribute('event');
  const rawRef = el.getAttribute('ref');
  const sourceLocation = `<setvalue event="${rawEvent ?? ''}" ref="${rawRef ?? ''}">`;

  if (rawRef === null || rawRef === '') {
    throw new Error(`setvalue: missing required 'ref' attribute (${sourceLocation})`);
  }

  // v1 supports a single event token (no space-separated multi-event lists).
  if (rawEvent !== null && rawEvent.trim().includes(' ')) {
    const tokens = rawEvent.trim().split(/\s+/);
    for (const token of tokens) {
      if (normalizeEvent(token) === null) {
        throw new Error(
          `setvalue: unsupported event '${token}' on ref '${rawRef}' (${sourceLocation}). ` +
            "Supported events: 'odk-instance-first-load' (alias 'xforms-ready'), 'xforms-value-changed'.",
        );
      }
    }
    // All tokens individually valid but multi-event setvalue is still v1-unsupported
    // (JavaRosa allows it; this parser does not yet) — fail loud rather than
    // silently picking one.
    throw new Error(
      `setvalue: multiple events ('${rawEvent}') on ref '${rawRef}' are not supported in v1 (${sourceLocation}).`,
    );
  }

  const event = normalizeEvent(rawEvent);
  if (event === null) {
    throw new Error(
      `setvalue: unsupported event '${rawEvent ?? ''}' on ref '${rawRef}' (${sourceLocation}). ` +
        "Supported events: 'odk-instance-first-load' (alias 'xforms-ready'), 'xforms-value-changed'.",
    );
  }

  const target = resolveTargetRef(rawRef, hostRef, sourceLocation);

  const valueAttr = el.getAttribute('value');
  let expr: ReturnType<typeof compileInstanceXPath> | null = null;
  let literal: string | null = null;
  let valueDeps: readonly TreeReference[] = [];

  if (valueAttr !== null) {
    expr = compileInstanceXPath(valueAttr);
    const parsed = sharedParser.parse(valueAttr).rootNode;
    valueDeps = getTriggers(parsed, target, target);
  } else {
    literal = directTextContent(el) ?? '';
  }

  const triggers: TreeReference[] =
    event === 'xforms-value-changed'
      ? dedupeRefs([...valueDeps, ...(hostRef !== null ? [hostRef] : [])])
      : [];

  return {
    event,
    target,
    expr,
    literal,
    triggers,
    contextRef: target,
    originalContextRef: target,
    sourceLocation,
  };
}

function dedupeRefs(refs: readonly TreeReference[]): TreeReference[] {
  const seen = new Set<string>();
  const result: TreeReference[] = [];
  for (const ref of refs) {
    const key = ref.levels.map((lvl) => `${lvl.name}[${lvl.multiplicity}]`).join('/');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(ref);
    }
  }
  return result;
}

/**
 * Collects all model-level `<setvalue>` action children of `<model>`
 * (direct children only — model actions are not nested inside other model
 * elements in v1).
 */
export function collectModelActions(modelEl: Element | null): SetValueAction[] {
  if (modelEl === null) return [];
  const actions: SetValueAction[] = [];
  const children = modelEl.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child && child.nodeType === 1 && (child as Element).localName === 'setvalue') {
      actions.push(parseSetValueAction(child as Element, null));
    }
  }
  return actions;
}

/**
 * Collects all body-nested `<setvalue>` action elements, walking the full
 * body DOM tree (setvalue may appear as a direct child of a control, a
 * group, or a repeat). `hostRef` for a given `<setvalue>` is the ref of the
 * nearest enclosing element that carries a `ref`/`nodeset` attribute
 * (its host control/group/repeat), or null if none is found.
 */
export function collectBodyActions(bodyEl: Element | null): SetValueAction[] {
  if (bodyEl === null) return [];
  const actions: SetValueAction[] = [];

  function walk(el: Element, hostRef: TreeReference | null): void {
    const refAttr = el.getAttribute('ref') ?? el.getAttribute('nodeset');
    const currentHostRef = refAttr !== null && refAttr !== '' ? parseAbsoluteRef(refAttr) : hostRef;

    const children = el.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child || child.nodeType !== 1) continue;
      const childEl = child as Element;
      if (childEl.localName === 'setvalue') {
        actions.push(parseSetValueAction(childEl, currentHostRef));
      } else {
        walk(childEl, currentHostRef);
      }
    }
  }

  walk(bodyEl, null);
  return actions;
}
