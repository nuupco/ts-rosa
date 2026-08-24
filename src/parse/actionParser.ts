/**
 * actionParser — parses `<setvalue>` action elements (model-level and
 * body-nested) into `SetValueAction` records.
 *
 * Kept separate from handlers.ts (FormElement production) per design
 * doc "sdd/setvalue-actions/design" section "Integration points".
 *
 * Scope (this module):
 *   - Recognizes `<setvalue event="..." ref="..." value="...">` (attribute
 *     value) or `<setvalue event="..." ref="...">inner text</setvalue>`.
 *   - `event` accepts a space-separated list of tokens (JavaRosa parity —
 *     see sdd/setvalue-parity design Decision 1); `parseSetValueActions`
 *     returns one `SetValueAction` per token, sharing the same compiled
 *     target/value expression.
 *   - Fails loud (throws) on:
 *       - missing/unsupported `event` attribute value or token
 *       - `jr-insert` declared on a body-nested (non-model) `<setvalue>`
 *         (design Decision 5 — model-level only)
 *       - missing `ref` attribute
 *       - a `ref` that would require repeat-relative resolution (v1 limit —
 *         only absolute and simple host-relative single targets are
 *         supported; see `resolveTargetRef`. Runtime target ref resolution
 *         via the XPath seam is a later PR, see design Decision 2.)
 *   - Does NOT wire actions into TriggerableDag (separate ActionRegistry,
 *     a later PR).
 */

import { compileInstanceXPath } from '../xpath/seam/XPathSeam.ts';
import { getTriggers } from '../eval/getTriggers.ts';
import { PureJSExpressionParser } from '../xpath/parser/PureJSExpressionParser.ts';
import { normalizeEvent, type SetValueAction } from '../eval/SetValueAction.ts';
import { parseAbsoluteRef, contextualize, type TreeReference } from '../model/instance/TreeReference.ts';
import { directTextContent } from './domHelpers.ts';

const sharedParser = new PureJSExpressionParser();

/** Strips all `[...]` bracketed predicates from a raw ref string. */
function stripPredicates(rawRef: string): string {
  return rawRef.replace(/\[[^\]]*]/g, '');
}

/**
 * Derives the predicate-free `genericTarget` ref used ONLY for
 * `ActionRegistry` keying and as the `getTriggers` context ref for the
 * value expression — NEVER for writing (sdd/setvalue-parity design
 * Decision 4). The actual write target is resolved at fire time via the
 * XPath seam (see `FormEvaluator.fireActionInner`), which is why this
 * function tolerates (by simply stripping) any predicate shape instead of
 * requiring numeric ones like `parseAbsoluteRef` does.
 */
export function deriveGenericTarget(rawRef: string, hostRef: TreeReference | null, sourceLocation: string): TreeReference {
  const stripped = stripPredicates(rawRef);

  if (stripped.startsWith('/')) {
    return parseAbsoluteRef(stripped);
  }

  if (hostRef === null) {
    throw new Error(
      `setvalue: relative target ref '${rawRef}' has no host control context to resolve against (${sourceLocation}). ` +
        "Model-level setvalue actions must use an absolute ref (starting with '/').",
    );
  }

  // Parse the stripped relative path into a bare (non-contextualized)
  // TreeReference, then anchor it onto the host ref.
  const relativeLevels = parseAbsoluteRef(`/${stripped}`).levels;
  const relativeRef: TreeReference = {
    refLevel: 0,
    contextType: 'original',
    instanceName: null,
    levels: relativeLevels,
  };
  return contextualize(relativeRef, hostRef);
}

/**
 * Parses a single `<setvalue>` DOM element into one `SetValueAction` per
 * space-separated event token in its `event` attribute — JavaRosa allows a
 * `<setvalue>` to declare multiple events on the same target
 * (`Actions.java`); each token becomes its own registration sharing the same
 * compiled target/value expression (design Decision 1).
 *
 * @param el - the `<setvalue>` element.
 * @param hostRef - absolute ref of the enclosing control (body-nested case),
 *   or null for model-level setvalue elements.
 */
export function parseSetValueActions(el: Element, hostRef: TreeReference | null): SetValueAction[] {
  const rawEvent = el.getAttribute('event');
  const rawRef = el.getAttribute('ref');
  const sourceLocation = `<setvalue event="${rawEvent ?? ''}" ref="${rawRef ?? ''}">`;

  if (rawRef === null || rawRef === '') {
    throw new Error(`setvalue: missing required 'ref' attribute (${sourceLocation})`);
  }

  const tokens = rawEvent !== null ? rawEvent.trim().split(/\s+/).filter((t) => t.length > 0) : [];
  if (tokens.length === 0) {
    throw new Error(
      `setvalue: unsupported event '${rawEvent ?? ''}' on ref '${rawRef}' (${sourceLocation}). ` +
        "Supported events: 'odk-instance-first-load' (alias 'xforms-ready'), 'xforms-value-changed', " +
        "'odk-new-repeat', 'jr-insert'.",
    );
  }

  const events: SetValueAction['event'][] = [];
  for (const token of tokens) {
    const event = normalizeEvent(token);
    if (event === null) {
      throw new Error(
        `setvalue: unsupported event '${token}' on ref '${rawRef}' (${sourceLocation}). ` +
          "Supported events: 'odk-instance-first-load' (alias 'xforms-ready'), 'xforms-value-changed', " +
          "'odk-new-repeat', 'jr-insert'.",
      );
    }
    if (event === 'jr-insert' && hostRef !== null) {
      throw new Error(
        `setvalue: 'jr-insert' is only supported on model-level setvalue actions, not on a body-nested ` +
          `<setvalue> (${sourceLocation}). Declare this action directly under <model> instead.`,
      );
    }
    events.push(event);
  }

  const targetExpr = compileInstanceXPath(rawRef);
  const genericTarget = deriveGenericTarget(rawRef, hostRef, sourceLocation);

  const valueAttr = el.getAttribute('value');
  let expr: ReturnType<typeof compileInstanceXPath> | null = null;
  let literal: string | null = null;
  let valueDeps: readonly TreeReference[] = [];

  if (valueAttr !== null) {
    expr = compileInstanceXPath(valueAttr);
    const parsed = sharedParser.parse(valueAttr).rootNode;
    valueDeps = getTriggers(parsed, genericTarget, genericTarget);
  } else {
    literal = directTextContent(el) ?? '';
  }

  return events.map((event) => {
    const triggers: TreeReference[] =
      event === 'xforms-value-changed'
        ? dedupeRefs([...valueDeps, ...(hostRef !== null ? [hostRef] : [])])
        : [];

    return {
      event,
      targetSource: rawRef,
      targetExpr,
      hostRef,
      genericTarget,
      expr,
      literal,
      triggers,
      sourceLocation,
    };
  });
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
      actions.push(...parseSetValueActions(child as Element, null));
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
    // Only a plain absolute path (no XPath function calls, only optionally
    // numeric `[N]` predicates — sdd/setvalue-parity Decision 7) can be used
    // to track hostRef context here. Other ref/nodeset shapes (e.g. an
    // `<itemset nodeset="instance('x')/root/item[a = /data/b]">`) are not
    // setvalue-relevant hosts; parseAbsoluteRef now throws on non-numeric
    // predicates, so such attributes are simply skipped (hostRef unchanged)
    // rather than crashing the whole body walk.
    let currentHostRef = hostRef;
    if (refAttr !== null && refAttr !== '' && refAttr.startsWith('/')) {
      try {
        currentHostRef = parseAbsoluteRef(refAttr);
      } catch {
        currentHostRef = hostRef;
      }
    }

    const children = el.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child || child.nodeType !== 1) continue;
      const childEl = child as Element;
      if (childEl.localName === 'setvalue') {
        actions.push(...parseSetValueActions(childEl, currentHostRef));
      } else {
        walk(childEl, currentHostRef);
      }
    }
  }

  walk(bodyEl, null);
  return actions;
}
