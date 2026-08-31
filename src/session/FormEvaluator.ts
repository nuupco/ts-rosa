/**
 * FormEvaluator — Slice 3.1 skeleton + Slice 3.4 cascade engine + Slice 3.5 Condition/relevance.
 *
 * Responsibilities:
 *   - Evaluate XPath expressions over an InstanceTree via InstanceEvaluator
 *   - Manage reactive cascade (triggerTriggerables) via TriggerableDag
 *   - Manage NodeState per bound node (Slice 3.5)
 *   - Wire answerQuestion + validate()
 *
 * Slice 3.5 adds:
 *   - NodeState map keyed by refToString(genericize(ref))
 *   - OpaqueReactiveObjectFactory injection (default: identity)
 *   - Condition evaluation in initializeInstance and triggerTriggerables
 *   - isEffectivelyRelevant(ref): ancestor walk
 *   - relevanceOf closure injected into adapter via setActiveRelevanceCheck
 */

import type { InstanceTree } from '../model/instance/InstanceTree.ts';
import type { ItextTranslations } from '../model/def/Itext.ts';
import { makeItextResolver, type ItextResolver } from '../model/def/Itext.ts';
import { childrenNamed, type InstanceNode } from '../model/instance/InstanceNode.ts';
import { answerValueToXPathString } from '../xpath/adapter/instance/answerValueToXPathString.ts';
import {
  makeInstanceDocumentNode,
  wrapInstanceNode,
  setActiveRelevanceCheck,
  setActiveChoiceNameResolver,
  getActiveChoiceNameResolver,
  XPATH_EVALUATION_RESULT,
  evaluateInstanceExpr,
  type InstanceDocumentNode,
  type InstanceXPathNode,
  type InstanceElementNode,
  type InstanceEvaluationContext,
  type CompiledInstanceExpression,
} from '../xpath/seam/XPathSeam.ts';
import type { TriggerableDag } from '../eval/TriggerableDag.ts';
import type { Triggerable } from '../eval/Triggerable.ts';
import type { TreeReference } from '../model/instance/TreeReference.ts';
import { genericize, refToString, parentOf, parseAbsoluteRef, REF_ABSOLUTE } from '../model/instance/TreeReference.ts';
import { level } from '../model/instance/TreeReferenceLevel.ts';
import { INDEX_TEMPLATE, INDEX_UNBOUND } from '../model/instance/multiplicity.ts';
import { resolveReference, resolveAll, resolveAllWithin, resolveAllContextualized } from '../model/instance/InstanceTree.ts';
import { cast } from '../model/data/codecs.ts';
import type { AnswerValue } from '../model/data/AnswerValue.ts';
import { type NodeState, defaultNodeState } from '../model/state/NodeState.ts';
import {
  type OpaqueReactiveObjectFactory,
  identityReactiveFactory,
} from '../platform/ReactiveObjectFactory.ts';
import type { CompiledBinding } from '../parse/bindProcessor.ts';
import type { FormElement, ItemsetDef } from '../model/def/FormElement.ts';
import { PureJSExpressionParser } from '../xpath/parser/PureJSExpressionParser.ts';
import { tokenize, TokenKind } from '../xpath/parser/Tokenizer.ts';
import { getTriggers } from '../eval/getTriggers.ts';
import { AnswerResult } from './AnswerResult.ts';
import { checkRankPermutation, type RankPermutationResult } from '../model/validation/rankPermutation.ts';
import type { ActionRegistry } from '../eval/ActionRegistry.ts';
import type { SetValueAction } from '../eval/SetValueAction.ts';

// ---------------------------------------------------------------------------
// ValidateOutcome — internal engine type (not Scenario harness type)
// ---------------------------------------------------------------------------

/**
 * Result of a full-form validation sweep.
 * Mirrors JavaRosa ValidateOutcome — null means the form is valid.
 */
export interface ValidateOutcome {
  /** The absolute path (nodeset) of the first field that failed validation. */
  readonly failedNodeset: string;
  /** The reason for failure. */
  readonly status: AnswerResult.REQUIRED_BUT_EMPTY | AnswerResult.CONSTRAINT_VIOLATED | AnswerResult.RANK_INVALID;
}

/** A resolved dynamic choice item returned by getChoices(). */
export interface SelectChoice {
  /** The value string (from <value ref="..."/> evaluation). */
  readonly value: string;
  /** The label string (from <label ref="..."/> or itext resolution). Null if unresolvable. */
  readonly label: string | null;
}

/** Options bag for FormEvaluator constructor (all optional for backward compat). */
export interface FormEvaluatorOptions {
  readonly factory?: OpaqueReactiveObjectFactory;
  readonly itext?: ItextTranslations | null;
  readonly secondaryInstances?: ReadonlyMap<string, InstanceTree>;
  /** Body element tree — needed by getChoices() to find ItemsetDef by ref. */
  readonly body?: readonly FormElement[];
}

export class FormEvaluator {
  private readonly tree: InstanceTree;
  private docNode: InstanceDocumentNode;
  /** Reactive DAG — set by initializeInstance; null until a form with bindings is loaded. */
  private dag: TriggerableDag | null = null;

  /**
   * setvalue ActionRegistry — set by setActionRegistry (session-creation
   * time, src/session/FormSession.ts). Null when the form declares no
   * setvalue actions (buildActionRegistry always returns a non-null
   * registry, but a session that never calls setActionRegistry — e.g. tests
   * constructing FormEvaluator directly — has no actions to fire).
   * sdd/setvalue-actions PR2.
   */
  private actionRegistry: ActionRegistry | null = null;

  /** NodeState per bound node — keyed by refToString(genericize(ref)). */
  private readonly nodeStates: Map<string, NodeState> = new Map();

  /** Factory for creating reactive node state objects (default: identity). */
  private readonly factory: OpaqueReactiveObjectFactory;

  /**
   * Compiled constraint expressions, keyed by nodeset string (e.g. "/data/a").
   * Set by initializeInstance from the FormDefinition.constraintBindings.
   */
  private constraintBindings: ReadonlyMap<string, CompiledBinding> = new Map();

  /** Itext resolver for the active session. Null when form has no itext. */
  private readonly itextResolver: ItextResolver | null;

  /** Wrapped secondary instance roots, keyed by id. Read by native instance() fn via docNode. */
  private readonly secondaryDocs: ReadonlyMap<string, InstanceXPathNode>;

  /** Body element tree — used to find ItemsetDef by ref in getChoices(). */
  private readonly body: readonly FormElement[] = [];

  /**
   * Cache for dynamic choice results, keyed by question ref string.
   * Each entry stores the trigger-signature computed when choices were last
   * evaluated; a changed signature triggers recomputation.
   */
  private readonly choiceCache: Map<string, { triggerSig: string; choices: readonly SelectChoice[] }> = new Map();

  /**
   * Equality-filter itemset index, mirroring JavaRosa's
   * EqualityExpressionIndexFilterStrategy: for the common
   * `instance('id')/path/item[column = ref]` choice_filter shape, index all
   * candidate items by `column`'s string value ONCE (built lazily, on first
   * use, keyed by instance id + item path + column name), so that every
   * subsequent choice_filter evaluation against a DIFFERENT ref value (e.g.
   * the user picking a different municipio) is an O(1) map lookup instead
   * of a full O(n) rescan of the secondary instance. Safe to cache for the
   * lifetime of this FormEvaluator: secondaryDocs/tree are populated once in
   * the constructor and never replaced (see FormSession.createFormSession).
   */
  private readonly itemsetIndexCache = new Map<string, Map<string, readonly InstanceNode[]>>();

  constructor(tree: InstanceTree, opts?: OpaqueReactiveObjectFactory | FormEvaluatorOptions) {
    this.tree = tree;

    // Support both legacy `new FormEvaluator(tree, factory)` and new opts bag
    let factory: OpaqueReactiveObjectFactory | undefined;
    let itextTranslations: ItextTranslations | null = null;
    let secondaryInstances: ReadonlyMap<string, InstanceTree> | undefined;

    if (opts === undefined) {
      factory = undefined;
    } else if (typeof opts === 'function') {
      // Legacy: second arg is the factory function directly
      factory = opts;
    } else {
      factory = opts.factory;
      itextTranslations = opts.itext ?? null;
      secondaryInstances = opts.secondaryInstances;
      this.body = opts.body ?? [];
    }

    this.factory = factory ?? identityReactiveFactory;
    this.itextResolver = itextTranslations !== null ? makeItextResolver(itextTranslations) : null;

    // Build per-session secondary instance document nodes.
    // instance() returns the document node so that `instance('id')/root/item`
    // navigates: document → root element → item children (JavaRosa semantics).
    if (secondaryInstances !== undefined && secondaryInstances.size > 0) {
      const docs = new Map<string, InstanceXPathNode>();
      for (const [id, secTree] of secondaryInstances) {
        const secDoc = makeInstanceDocumentNode(secTree);
        docs.set(id, secDoc);
      }
      this.secondaryDocs = docs;
    } else {
      this.secondaryDocs = new Map();
    }

    const docNodeOpts = this.secondaryDocs.size > 0
      ? { itext: this.itextResolver, secondaryInstances: this.secondaryDocs }
      : { itext: this.itextResolver };
    this.docNode = makeInstanceDocumentNode(tree, docNodeOpts);
  }

  // ---------------------------------------------------------------------------
  // Slice 5a — language management
  // ---------------------------------------------------------------------------

  /**
   * Switch the active language for itext resolution.
   * Throws when `lang` is not in the form's translation list (REQ-5A-4).
   * Passing null resets to the default language.
   * No-op when the form has no itext block.
   */
  setLanguage(lang: string | null): string | null {
    if (this.itextResolver === null) {
      // Form has no itext — nothing to do (no error; graceful no-op)
      return null;
    }
    return this.itextResolver.setActiveLanguage(lang);
  }

  /**
   * Return the list of available languages (in declaration order).
   * Returns empty array when form has no itext.
   */
  getLanguages(): readonly string[] {
    return this.itextResolver?.getLanguages() ?? [];
  }

  /**
   * Return the currently active language.
   * Returns null when form has no itext.
   */
  getActiveLanguage(): string | null {
    return this.itextResolver?.getActiveLanguage() ?? null;
  }

  /**
   * Resolve an itext id to its string value in the active language.
   * Returns null when the id is absent in all languages.
   * Returns null when form has no itext.
   */
  resolveItext(id: string): string | null {
    return this.itextResolver?.resolve(id) ?? null;
  }

  /**
   * Resolve an itext id to its {text, outputs} pair in the active language.
   * Returns null when the id is absent in all languages, or when the form
   * has no itext. Added in output-label-substitution PR3.
   */
  resolveItextWithOutputs(id: string): { text: string; outputs: readonly string[] } | null {
    return this.itextResolver?.resolveWithOutputs(id) ?? null;
  }

  // ---------------------------------------------------------------------------
  // output-label-substitution PR3 — read-time <output> substitution
  // ---------------------------------------------------------------------------

  /**
   * Replace each `${n}` placeholder in `template` with the string result of
   * evaluating `outputs[n]` against `node` (the question's context node).
   * Reuses the same relative-context XPath evaluator as itemset value/label
   * resolution (evaluateRelativeOnNode) — no new evaluation mechanism.
   *
   * Invalid/empty XPath results substitute as an empty string (JavaRosa
   * parity for FormEntryPrompt#substituteStringArgs); evaluation errors are
   * caught and never propagate to the caller.
   */
  private substituteOutputs(
    template: string,
    outputs: readonly string[],
    node: InstanceXPathNode,
  ): string {
    if (outputs.length === 0) return template;
    return template.replace(/\$\{(\d+)\}/g, (_match, idxStr: string) => {
      const output = outputs[Number(idxStr)];
      if (output === undefined) return '';
      try {
        return this.evaluateRelativeOnNode(output, node);
      } catch {
        return '';
      }
    });
  }

  /**
   * Read-time substitution entry point for question label/hint text.
   *
   * Resolves `contextRef`'s InstanceNode (the question's own ref — repeat-
   * relative outputs like `../name` resolve against THIS specific instance,
   * not the primary instance root) and substitutes every `${n}` placeholder
   * in `template` using `outputs`. Returns `template` unchanged when there
   * are no outputs (cheap no-op path). Returns `null` when `template` is
   * `null`. Never throws.
   */
  substituteText(
    template: string | null,
    outputs: readonly string[],
    contextRef: TreeReference,
  ): string | null {
    if (template === null) return null;
    if (outputs.length === 0) return template;
    const contextNode = resolveReference(this.tree, contextRef);
    const ctx = this.makeContext(contextNode);
    return this.substituteOutputs(template, outputs, ctx.contextNode);
  }

  // ---------------------------------------------------------------------------
  // Slice 5c — dynamic choice resolution
  // ---------------------------------------------------------------------------

  /**
   * Get the dynamic choices for the question at `ref`.
   *
   * Algorithm (JavaRosa-style on-demand):
   *  1. Find the question's ItemsetDef via the body tree.
   *  2. If no itemset → return static choices (mapped to SelectChoice, resolving itext labels).
   *  3. Compute trigger-signature: string-values of form-field triggers in nodesetExpr predicates.
   *  4. Cache hit (same sig) → return cached.
   *  5. Cache miss → evaluate nodesetExpr as nodeset, map each result node to SelectChoice.
   *
   * Choices reflect instance state AT CALL TIME (REQ-5C-4 stale-choice contract).
   */
  getChoices(ref: TreeReference): readonly SelectChoice[] {
    const refKey = refToString(ref);

    // Find the question element in the body tree
    const questionEl = this.findQuestionByRef(ref);

    // No body element or no itemset → return static choices
    if (questionEl === null || questionEl.itemset === null) {
      // Static choices — resolve itext labels if needed
      return (questionEl?.choices ?? []).map((c) => ({
        value: c.value,
        label: c.labelIsItext === true && c.labelItextId != null
          ? (this.itextResolver?.resolve(c.labelItextId) ?? c.labelText)
          : c.labelText,
      }));
    }

    const itemset = questionEl.itemset;

    // Compute trigger signature.
    // When labels are itext-driven, append the active language so a language
    // switch correctly invalidates the cache.
    const triggerSig = this.computeTriggerSig(itemset.nodesetExpr, ref, itemset.labelIsItext);

    // Cache check
    const cached = this.choiceCache.get(refKey);
    if (cached !== undefined && cached.triggerSig === triggerSig) {
      return cached.choices;
    }

    // Evaluate the nodeset — use the question's context node so current()
    // and relative predicates resolve against the answered main instance
    const contextNode = resolveReference(this.tree, ref);
    const ctx = this.makeContext(contextNode);

    const fastPathNodes = this.tryEqualityFilterFastPath(itemset, ctx.contextNode);

    // Collect result nodes
    const choices: SelectChoice[] = [];

    if (fastPathNodes !== null) {
      for (const node of fastPathNodes) {
        const value = this.evaluateRelativeOnNode(itemset.valueExpr, node);
        const label = this.resolveChoiceLabel(itemset, node);
        choices.push({ value, label });
      }
    } else {
      // Evaluate nodesetExpr as ANY_TYPE (nodeset)
      const result = evaluateInstanceExpr(
        itemset.nodesetExpr,
        ctx.contextNode,
        XPATH_EVALUATION_RESULT.ANY_TYPE,
      );

      let node = result.iterateNext();
      while (node !== null) {
        if (node.kind === 'element') {
          const value = this.evaluateRelativeOnNode(itemset.valueExpr, node);
          const label = this.resolveChoiceLabel(itemset, node);
          choices.push({ value, label });
        }
        node = result.iterateNext();
      }
    }

    // Store and return
    const frozen = Object.freeze(choices);
    this.choiceCache.set(refKey, { triggerSig, choices: frozen });
    return frozen;
  }

  // Matches: instance('id')/seg1/seg2.../item[ column = ref ]  (either operand
  // order). Deliberately conservative — no nested brackets, no compound
  // predicates, no functions — anything else falls through to null and the
  // generic evaluator runs unchanged.
  private static readonly EQUALITY_FILTER_SHAPE_RE =
    /^instance\((['"])([^'"]*)\1\)((?:\/[A-Za-z_][\w\-.]*)+)\[\s*([^[\]=]+?)\s*=\s*([^[\]=]+?)\s*\]$/;

  private static isBareName(s: string): boolean {
    return /^[A-Za-z_][\w\-.]*$/.test(s);
  }

  /**
   * Fast path for the classic choice_filter shape
   * `instance('id')/path/item[column = ref]` (JavaRosa's
   * EqualityExpressionIndexFilterStrategy equivalent): index all candidate
   * items by `column`'s string value once, then serve every subsequent
   * distinct `ref` value as an O(1) lookup instead of rescanning the whole
   * secondary instance through the generic XPath evaluator. Returns null
   * (falling back to the generic evaluator, unchanged) whenever the shape
   * isn't recognized with full confidence — this must never guess.
   */
  private tryEqualityFilterFastPath(
    itemset: ItemsetDef,
    questionContextNode: InstanceXPathNode,
  ): readonly InstanceXPathNode[] | null {
    const match = FormEvaluator.EQUALITY_FILTER_SHAPE_RE.exec(itemset.nodesetExpr.trim());
    if (match === null) return null;

    const [, , instanceId, pathExpr, lhsRaw, rhsRaw] = match;
    const segments = pathExpr!.split('/').filter((s) => s.length > 0);
    if (segments.length < 2) return null;

    const lhsIsBare = FormEvaluator.isBareName(lhsRaw!);
    const rhsIsBare = FormEvaluator.isBareName(rhsRaw!);

    let columnName: string;
    let refExpr: string;
    if (lhsIsBare && !rhsIsBare) {
      columnName = lhsRaw!;
      refExpr = rhsRaw!;
    } else if (rhsIsBare && !lhsIsBare) {
      columnName = rhsRaw!;
      refExpr = lhsRaw!;
    } else {
      // Ambiguous (both or neither side is a bare column name) — don't guess.
      return null;
    }

    const doc = this.secondaryDocs.get(instanceId!);
    if (doc === undefined || doc.kind !== 'document') return null;

    const root = doc.tree.root;
    if (root.name !== segments[0]) return null;

    // Walk down to the item-level parent: every intermediate segment must
    // resolve to exactly one child. An absent or ambiguous step bails out
    // to the generic evaluator rather than guessing.
    let parent = root;
    for (let i = 1; i < segments.length - 1; i++) {
      const matches = childrenNamed(parent, segments[i]!);
      if (matches.length !== 1) return null;
      parent = matches[0]!;
    }

    const itemName = segments[segments.length - 1]!;
    const items = childrenNamed(parent, itemName);

    // A quoted literal needs no evaluation; anything else is a real (small,
    // single-value) XPath expression evaluated the normal way against the
    // question's context — only the candidate-item SCAN is fast-pathed, not
    // the filter value itself.
    const literalMatch = /^(['"])([^'"]*)\1$/.exec(refExpr);
    const targetValue = literalMatch !== null
      ? literalMatch[2]!
      : evaluateInstanceExpr(refExpr, questionContextNode, XPATH_EVALUATION_RESULT.STRING_TYPE).stringValue;

    // JSON.stringify of a tuple, not string concatenation: instanceId is
    // arbitrary form-author text and could itself contain any delimiter.
    const cacheKey = JSON.stringify([instanceId, pathExpr, columnName]);
    let index = this.itemsetIndexCache.get(cacheKey);

    if (index === undefined) {
      const built = new Map<string, InstanceNode[]>();

      for (const item of items) {
        const col = childrenNamed(item, columnName)[0];
        if (col === undefined) continue;

        const key = answerValueToXPathString(col.value);
        let bucket = built.get(key);

        if (bucket === undefined) {
          bucket = [];
          built.set(key, bucket);
        }

        bucket.push(item);
      }

      index = built;
      this.itemsetIndexCache.set(cacheKey, index);
    }

    const matchedItems = index.get(targetValue) ?? [];
    return matchedItems.map((item) => wrapInstanceNode(item, doc));
  }

  /**
   * @experimental
   * Fully clears the choice cache.
   *
   * Used by FormNavigator.deleteRepeat: after a repeat instance is removed,
   * remaining sibling instances are re-indexed (shifted down), so a cache
   * entry keyed by a concrete ref may now describe a DIFFERENT instance than
   * the one it was computed for. getChoices' triggerSig check does not catch
   * this when two instances happen to share the same trigger value(s), so an
   * explicit full-clear is required for correctness. Full-clear (rather than
   * subtree-scoped) is the simplest correct option and is consistent with the
   * already-accepted full-DAG-rerun cost model for repeat removal.
   */
  invalidateChoiceCache(): void {
    this.choiceCache.clear();
  }

  /**
   * Resolve a choice label for one itemset result node.
   *
   * This is the single coordination point between 5a (itext) and 5c (itemset).
   * - labelIsItext = false → evaluate labelExpr as XPath string against the node.
   * - labelIsItext = true, labelItextId non-null → static itext id, resolve directly.
   * - labelIsItext = true, labelItextId null → evaluate labelExpr as XPath to get
   *   the runtime itext id, then resolve that id.
   */
  private resolveChoiceLabel(itemset: ItemsetDef, node: InstanceXPathNode): string | null {
    if (!itemset.labelIsItext) {
      return this.evaluateRelativeOnNode(itemset.labelExpr, node) || null;
    }
    // itext label
    let itextId: string;
    if (itemset.labelItextId !== null) {
      // Static itext id: jr:itext('fruit:apple')
      itextId = itemset.labelItextId;
    } else {
      // Dynamic itext id: jr:itext(labelid) — evaluate labelExpr as XPath to get the id,
      // BUT the labelExpr itself is like "jr:itext(labelid)" — we need the inner XPath.
      // Extract the inner expression: jr:itext(<inner>)
      const innerMatch = /jr:itext\(\s*(.+?)\s*\)/s.exec(itemset.labelExpr);
      if (innerMatch === null) {
        // Fallback: use labelExpr directly as itext id
        itextId = itemset.labelExpr;
      } else {
        const innerExpr = innerMatch[1]!;
        // Evaluate the inner expression against the node to get the itext id
        itextId = this.evaluateRelativeOnNode(innerExpr, node);
      }
    }
    return this.itextResolver?.resolve(itextId) ?? null;
  }

  /**
   * Evaluate a relative XPath expression against an InstanceXPathNode.
   * Returns the string result (or empty string on error/empty nodeset).
   */
  private evaluateRelativeOnNode(expr: string, node: InstanceXPathNode): string {
    return this.withActiveChoiceNameResolver(() => {
      const result = evaluateInstanceExpr(expr, node, XPATH_EVALUATION_RESULT.ANY_TYPE);
      switch (result.resultType) {
        case XPATH_EVALUATION_RESULT.STRING_TYPE:
          return result.stringValue;
        case XPATH_EVALUATION_RESULT.NUMBER_TYPE:
          return String(result.numberValue);
        case XPATH_EVALUATION_RESULT.BOOLEAN_TYPE:
          return result.booleanValue ? 'true' : 'false';
        default: {
          // Nodeset: get string value of first node
          const first = result.iterateNext();
          if (first === null) return '';
          return evaluateInstanceExpr('string(.)', first, XPATH_EVALUATION_RESULT.STRING_TYPE).stringValue;
        }
      }
    });
  }

  /**
   * Run `fn` with the active jr:choice-name() resolver set to this
   * FormEvaluator's own resolveChoiceName, restoring whatever was active
   * before on exit (safe for nested/re-entrant calls, and for multiple
   * FormEvaluator instances alive at once — see setActiveChoiceNameResolver).
   */
  private withActiveChoiceNameResolver<T>(fn: () => T): T {
    const previous = getActiveChoiceNameResolver();
    setActiveChoiceNameResolver((node, value) => this.resolveChoiceName(node, value));
    try {
      return fn();
    } finally {
      setActiveChoiceNameResolver(previous);
    }
  }

  /**
   * Implements jr:choice-name()'s node-side contract (XPathChoiceNode):
   * given an InstanceElementNode bound to a select/select1 question and a
   * choice value/token, resolve that choice's label — static or itemset,
   * itext-translated if applicable. Reuses getChoices() entirely (same
   * cache, same static/itemset branching, same itext resolution) rather
   * than duplicating any of that logic here.
   *
   * Returns null when `node` isn't bound to a recognized select question or
   * `value` doesn't match any of its choices — jr:choice-name() then
   * returns '' rather than throwing (fail-soft: a form-authoring mistake
   * shouldn't crash the session).
   */
  private resolveChoiceName(node: InstanceElementNode, value: string): string | null {
    const ref = this.nodeToRef(node);
    if (ref === null) return null;
    return this.getChoices(ref).find((c) => c.value === value)?.label ?? null;
  }

  /**
   * Compute a trigger signature for the given nodesetExpr.
   *
   * Extracts trigger references from predicates in nodesetExpr using getTriggers,
   * evaluates their current string values, and concatenates them with a separator.
   * A changed signature means the filtered result set may differ → cache invalidated.
   *
   * When no triggers are found (e.g. unfiltered secondary instance), returns a
   * constant string → permanent cache hit (correct: secondary instances are immutable).
   */
  private computeTriggerSig(nodesetExpr: string, questionRef: TreeReference, labelIsItext = false): string {
    try {
      const parser = new PureJSExpressionParser();
      const parsed = parser.parse(nodesetExpr);
      const triggers = getTriggers(parsed.rootNode, questionRef, questionRef);
      const triggerPart = triggers.length === 0
        ? '__no_triggers__'
        : triggers.map((t) => String(this.evaluateOnInstance(refToString(t)))).join('\x01');
      // Append active language when labels are itext-driven so language
      // switches invalidate the cache correctly.
      const langPart = labelIsItext ? `\x02${this.itextResolver?.getActiveLanguage() ?? ''}` : '';
      return triggerPart + langPart;
    } catch {
      // On parse error, return a unique sig to force recomputation every call
      return String(Date.now());
    }
  }

  /**
   * Find the question FormElement for the given ref by walking the body tree.
   * Returns null if not found or if the body is empty.
   */
  private findQuestionByRef(ref: TreeReference): (FormElement & { kind: 'question' }) | null {
    // Body-tree question refs are templates: every ancestor level (e.g. a
    // repeat) has unbound multiplicity, while `ref` carries the concrete
    // multiplicity of the instance being evaluated. Compare against the
    // genericized form so questions inside repeats resolve correctly.
    const refKey = refToString(genericize(ref));
    let found: (FormElement & { kind: 'question' }) | null = null;

    function walk(elements: readonly FormElement[]): void {
      for (const el of elements) {
        if (el.kind === 'question') {
          if (refToString(el.ref) === refKey) {
            found = el;
            return;
          }
        } else {
          walk(el.children);
        }
      }
    }

    walk(this.body);
    return found;
  }

  /**
   * Applicability + delegation for the rank permutation rule.
   *
   * Returns null when the rule does not apply (empty value, non-selectMulti
   * kind, no question element, non-'rank' control, or an unresolved dynamic
   * itemset). Returns a RankPermutationResult when the rule was evaluated.
   *
   * See sdd/rank-validation design §2.3.
   */
  private checkRank(ref: TreeReference, value: AnswerValue | null): RankPermutationResult | null {
    if (value === null || isAnswerEmpty(value)) return null;
    if (value.kind !== 'selectMulti') return null;

    const questionEl = this.findQuestionByRef(ref);
    if (questionEl === null) return null;
    if (questionEl.controlType !== 'rank') return null;

    const choices = this.getChoices(ref);

    // Unresolved dynamic itemset (currently empty) → skip, not applicable.
    if (questionEl.itemset !== null && choices.length === 0) return null;

    return checkRankPermutation(value.value, choices.map((c) => c.value));
  }

  // ---------------------------------------------------------------------------
  // NodeState management
  // ---------------------------------------------------------------------------

  /**
   * Get or create NodeState for a genericized ref key.
   */
  private getOrCreateState(key: string): NodeState {
    let state = this.nodeStates.get(key);
    if (state === undefined) {
      state = this.factory(defaultNodeState());
      this.nodeStates.set(key, state);
    }
    return state;
  }

  /**
   * Return the effective relevance of a ref: own relevant AND all ancestors relevant.
   *
   * Mirrors JavaRosa TriggerableDag isEffectivelyRelevant — walks the ref's
   * parent chain consulting own NodeState.relevant for each ancestor.
   */
  isEffectivelyRelevant(ref: TreeReference): boolean {
    // Walk from the ref upward, checking NodeState.relevant at each level.
    //
    // Key format note: state is stored by applyCondition using nodeToRef, which assigns
    // concrete multiplicity [0] to all non-repeat scalars. FormNavigator's refs use
    // INDEX_UNBOUND for non-repeat elements. To bridge this mismatch, we try THREE keys:
    //   1. The ref's own string (FormNavigator format: concrete repeats, unbound scalars)
    //   2. A "fully concrete" key (all unbound levels → [0], to match nodeToRef format)
    //   3. The generic key (all levels unbound, for single-instance backward compat)
    //
    // For multi-instance repeat children, the generic key is "last write wins" and may
    // be poisoned by the last instance's evaluation. Prefer concrete keys over generic.
    let current: TreeReference = ref;
    while (current.levels.length > 0) {
      const navKey = refToString(current);
      const genericKey = refToString(genericize(current));

      // Build "fully concrete" version: replace INDEX_UNBOUND with 0 for non-root levels
      // to match nodeToRef format (root level stays INDEX_UNBOUND, scalars get [0]).
      const concreteLevels = current.levels.map((l, i) =>
        i > 0 && l.multiplicity < 0 ? level(l.name, 0) : l
      );
      const fullConcreteKey = refToString({ ...current, levels: Object.freeze(concreteLevels) });

      // Look up in order of specificity: navKey, fullConcreteKey, then generic
      const navState = this.nodeStates.get(navKey);
      const concreteState = navKey !== fullConcreteKey ? this.nodeStates.get(fullConcreteKey) : undefined;

      // If a concrete-ish state exists, trust it — it has per-instance accuracy.
      // Only fall back to generic if no concrete state was found at all.
      const definiteState = navState ?? concreteState;
      if (definiteState !== undefined) {
        if (!definiteState.relevant) return false;
        // Found a concrete state — do not also check generic (it may be poisoned)
      } else if (genericKey !== navKey) {
        // No concrete state found: check generic key (single-instance paths only)
        const genericState = this.nodeStates.get(genericKey);
        if (genericState !== undefined && !genericState.relevant) {
          return false;
        }
      }

      current = parentOf(current);
    }
    return true;
  }

  /**
   * Get the NodeState for a ref (by genericized key). Returns undefined if not found.
   */
  getNodeState(ref: TreeReference): NodeState | undefined {
    return this.nodeStates.get(refToString(genericize(ref)));
  }

  // ---------------------------------------------------------------------------
  // Slice 3.1 — XPath evaluation primitives
  // ---------------------------------------------------------------------------

  /**
   * Build an InstanceEvaluationContext for a given context InstanceNode.
   * When contextNode is null/undefined the document root is used.
   */
  private makeContext(
    contextNode?: InstanceNode | null,
  ): InstanceEvaluationContext {
    const ctxWrapper: InstanceXPathNode =
      contextNode != null
        ? wrapInstanceNode(contextNode, this.docNode)
        : wrapInstanceNode(this.tree.root, this.docNode);

    return {
      instanceRoot: this.docNode,
      contextNode: ctxWrapper,
    };
  }

  /**
   * Evaluate an XPath expression string over the InstanceTree.
   *
   * Returns a primitive (string | number | boolean) or the first node's
   * string-value when the result is a nodeset.
   */
  evaluateOnInstance(
    expr: string,
    contextNode?: InstanceNode | null,
  ): string | number | boolean {
    return this.withActiveChoiceNameResolver(() => {
      const ctx = this.makeContext(contextNode);
      const result = evaluateInstanceExpr(expr, ctx.contextNode, XPATH_EVALUATION_RESULT.ANY_TYPE);

      switch (result.resultType) {
        case XPATH_EVALUATION_RESULT.BOOLEAN_TYPE:
          return result.booleanValue;
        case XPATH_EVALUATION_RESULT.NUMBER_TYPE:
          return result.numberValue;
        case XPATH_EVALUATION_RESULT.STRING_TYPE:
          return result.stringValue;
        default: {
          // Nodeset: return first node's string-value or empty string
          const first = result.iterateNext();
          if (first === null) return '';
          return evaluateInstanceExpr('string(.)', first, XPATH_EVALUATION_RESULT.STRING_TYPE).stringValue;
        }
      }
    });
  }

  /**
   * Evaluate a pre-compiled instance expression with the active relevance closure.
   * Used by the DAG-based cascade.
   */
  evaluateCompiled(
    compiled: CompiledInstanceExpression,
    contextNode?: InstanceNode | null,
  ): string | number | boolean {
    const ctx = this.makeContext(contextNode);

    // Inject the relevance closure into the adapter so non-relevant nodes return ''
    setActiveRelevanceCheck((node: InstanceXPathNode) => {
      if (node.kind !== 'element') return true;
      // Build a minimal ref for this node by walking parents
      const nodeRef = this.nodeToRef(node);
      if (nodeRef === null) return true;
      return this.isEffectivelyRelevant(nodeRef);
    });
    const previousChoiceNameResolver = getActiveChoiceNameResolver();
    setActiveChoiceNameResolver((node, value) => this.resolveChoiceName(node, value));

    let result: ReturnType<typeof compiled.evaluate>;
    try {
      result = compiled.evaluate(ctx);
    } finally {
      setActiveRelevanceCheck(null);
      setActiveChoiceNameResolver(previousChoiceNameResolver);
    }

    if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
      return result;
    }
    // Nodeset
    const nodes = result as readonly InstanceXPathNode[];
    if (nodes.length === 0) return '';
    const first = nodes[0];
    if (first === undefined) return '';
    return evaluateInstanceExpr('string(.)', first, XPATH_EVALUATION_RESULT.STRING_TYPE).stringValue;
  }

  /**
   * Derive a concrete TreeReference from an InstanceXPathNode by walking its parent chain.
   *
   * Per design §8: accumulates (name, positional multiplicity among same-name non-template siblings).
   * The resulting ref has concrete multiplicities (0-indexed position) at each level,
   * allowing per-instance NodeState keys and indexed-repeat unwrapping.
   *
   * Returns null if the node cannot be mapped (e.g. document node).
   */
  private nodeToRef(node: InstanceXPathNode): TreeReference | null {
    if (node.kind !== 'element') return null;

    // Walk from the target node up to the root, collecting (name, multiplicity) pairs
    const levels: Array<{ name: string; multiplicity: number }> = [];
    let current: InstanceNode | null = node.node;

    while (current !== null) {
      const curNode: InstanceNode = current;
      const parentNode: InstanceNode | null = curNode.parent;
      let multiplicity = curNode.multiplicity;

      if (parentNode !== null) {
        // Compute 0-indexed position among same-name non-template siblings
        const sameNameSiblings = parentNode.children.filter(
          (c: InstanceNode) => c.name === curNode.name && c.multiplicity !== INDEX_TEMPLATE,
        );
        const idx = sameNameSiblings.indexOf(curNode);
        multiplicity = idx >= 0 ? idx : curNode.multiplicity;
      }

      levels.unshift({ name: curNode.name, multiplicity });
      current = parentNode;
    }

    // Build TreeReference with concrete multiplicities
    // levels[0] is the root element (e.g. 'data'), use INDEX_UNBOUND for root
    const refLevels = levels.map(({ name, multiplicity }, i) => {
      // For the root level, use INDEX_UNBOUND (there's only one root)
      return level(name, i === 0 ? INDEX_UNBOUND : multiplicity);
    });

    return Object.freeze({
      refLevel: REF_ABSOLUTE,
      contextType: 'absolute' as const,
      instanceName: null,
      levels: Object.freeze(refLevels),
    });
  }

  /** Expose the document node for callers that need to build their own contexts. */
  getDocumentNode(): InstanceDocumentNode {
    return this.docNode;
  }

  /** Wrap an InstanceNode into an InstanceXPathNode for use in evaluations. */
  wrap(node: InstanceNode): InstanceXPathNode {
    return wrapInstanceNode(node, this.docNode);
  }

  /**
   * Determine whether an InstanceNode is effectively relevant.
   *
   * Reuses the existing private nodeToRef + isEffectivelyRelevant path (ADR-2).
   * Returns true when the ref cannot be derived (root or unresolvable nodes are
   * always considered relevant — no NodeState marks root non-relevant).
   *
   * Slice 6a — used by FormSession.serializeToXml to build the isRelevant
   * callback for serializeInstance without duplicating ref-derivation logic.
   */
  isNodeRelevant(node: InstanceNode): boolean {
    const xpathNode = this.wrap(node);
    const ref = this.nodeToRef(xpathNode);
    if (ref === null) return true;
    return this.isEffectivelyRelevant(ref);
  }

  // ---------------------------------------------------------------------------
  // Slice 3.4 — reactive cascade engine
  // ---------------------------------------------------------------------------

  /**
   * Initialize all triggerables in topological DAG order.
   *
   * Mirrors JavaRosa TriggerableDag.initializeTriggerables (FormDef.java:447-466).
   * Called once at session creation to bring the instance to steady state.
   *
   * Slice 3.5: also initializes NodeState for all bound nodes, and evaluates
   * all Conditions (relevant/required/readonly) to set initial NodeState.
   */
  initializeInstance(dag: TriggerableDag, constraintBindings?: ReadonlyMap<string, CompiledBinding>): void {
    this.dag = dag;
    if (constraintBindings !== undefined) {
      this.constraintBindings = constraintBindings;
    }

    // Pre-create NodeState for all targets in the DAG
    for (const triggerable of dag.triggerablesDAG) {
      for (const target of triggerable.targets) {
        const key = refToString(genericize(target));
        this.getOrCreateState(key);
      }
    }

    // Evaluate all triggerables in topological order
    for (const triggerable of dag.triggerablesDAG) {
      if (triggerable.kind === 'recalculate') {
        this.applyRecalculate(triggerable, null);
      } else if (triggerable.kind === 'condition') {
        this.applyCondition(triggerable, null);
      }
    }
  }

  /**
   * Write a value to the InstanceNode at ref, then trigger the reactive cascade.
   *
   * Mirrors JavaRosa FormDef.setValue + triggerTriggerables.
   * Option A: there is NO parallel DOM — the InstanceTree is the sole data store.
   */
  setValue(ref: TreeReference, value: AnswerValue | null): void {
    const node = resolveReference(this.tree, ref);
    if (node !== null) {
      node.value = value;
    }
  }

  /**
   * Trigger the cascade for a changed ref.
   *
   * Algorithm (mirrors JavaRosa TriggerableDag.triggerTriggerables):
   *   1. genericize changedRef → look up triggerablesPerTrigger
   *   2. Expand all downstream triggerables transitively via immediateCascades
   *   3. Iterate triggerablesDAG IN ORDER; evaluate only those in the toTrigger set
   *
   * @param changedRef  The ref that changed (used for lookup and context).
   * @param dag         Optional override dag. Defaults to the stored dag.
   */
  triggerTriggerables(changedRef: TreeReference, dag?: TriggerableDag | null): void {
    const activeDag = dag !== undefined ? dag : this.dag;
    if (activeDag === null) return;
    const useDag = activeDag;

    const genericRef = genericize(changedRef);
    const key = refToString(genericRef);
    const cascadeRoots = useDag.triggerablesPerTrigger.get(key);

    if (cascadeRoots !== undefined && cascadeRoots.size > 0) {
      const toTrigger = getAllToTrigger(cascadeRoots, useDag.immediateCascades);

      // Sort just the (usually small) toTrigger subset into topological
      // order via the precomputed index, instead of scanning the full
      // triggerablesDAG array to filter it down by Set membership — this
      // ran on EVERY answerQuestion() call regardless of how small
      // toTrigger actually was.
      const ordered = Array.from(toTrigger).sort(
        (a, b) => useDag.triggerableIndex.get(a)! - useDag.triggerableIndex.get(b)!,
      );

      for (const triggerable of ordered) {
        if (triggerable.kind === 'recalculate') {
          this.applyRecalculate(triggerable, changedRef);
        } else if (triggerable.kind === 'condition') {
          this.applyCondition(triggerable, changedRef);
        }
      }
    }

    // sdd/setvalue-actions PR3 (design ADR-4, section 5): fire xforms-value-changed
    // actions AFTER the DAG cascade above completes, so their value expressions
    // observe post-cascade values and they also fire when the trigger ref changes
    // indirectly via a calculate cascade (not just a direct answerQuestion write).
    // Deliberately placed at the tail of triggerTriggerables rather than as a new
    // Triggerable kind inside the DAG itself (ADR-1: actions stay outside
    // TriggerableDag — see src/eval/ActionRegistry.ts header).
    if (this.actionRegistry !== null) {
      const valueChangedActions = this.actionRegistry.valueChangedByTrigger.get(key);
      if (valueChangedActions !== undefined) {
        for (const action of valueChangedActions) {
          this.fireAction(action);
        }
      }
    }
  }

  /**
   * Install the setvalue ActionRegistry built from the session's
   * FormDefinition.actions (src/eval/ActionRegistry.ts). Must be called
   * before fireLoadActions(). A no-op call with an empty registry is safe —
   * fireLoadActions() then does nothing.
   *
   * sdd/setvalue-actions PR2, task 9.
   */
  setActionRegistry(registry: ActionRegistry): void {
    this.actionRegistry = registry;
  }

  /**
   * Fire all `odk-instance-first-load` (and `xforms-ready`-aliased) setvalue
   * actions, in declaration order, exactly once.
   *
   * Mirrors JavaRosa ActionController.triggerActionsFromEvent for the
   * FORM_LOAD event. Must be called AFTER initializeInstance's DAG cascade
   * has already brought the instance to its initial steady state (design
   * ADR-4) — a load action's value expression should see fully-cascaded
   * calculates, and each action's own triggerTriggerables call re-cascades
   * any downstream dependents of its target.
   *
   * Per design's edit-mode decision: ODK/XForms defines `odk-instance-first-load`
   * as firing whenever the instance is instantiated into the engine, including an
   * edit-mode reload of a previous submission — so this fires unconditionally on
   * both fresh and hydrated (instanceXml) sessions. It happens to align with
   * calculate's existing "always overwrite loaded values" behavior at
   * instantiation time, but a load-time setvalue is a one-shot imperative write,
   * not a standing declarative rule re-evaluated on every cascade like calculate —
   * the two are not architecturally identical, only aligned on this one point.
   * Grouped with `calculate` (fires), not with `preload` (skipped on hydration).
   *
   * sdd/setvalue-actions PR2, tasks 10-12.
   */
  fireLoadActions(): void {
    if (this.actionRegistry === null) return;
    for (const action of this.actionRegistry.loadActions) {
      this.fireAction(action);
    }
  }

  /**
   * Fire all `xforms-revalidate` setvalue actions, in declaration order.
   *
   * Mirrors JavaRosa FormDef#postProcessInstance, which triggers
   * EVENT_XFORMS_REVALIDATE before its own preload-postProcess tree walk.
   * Called from FormSession.finalize() — the finalize/submission lifecycle
   * point that previously did not exist in ts-rosa (docs/XLSFORM-COVERAGE.md).
   */
  fireRevalidateActions(): void {
    if (this.actionRegistry === null) return;
    const revalidateActions = this.actionRegistry.byEvent.get('xforms-revalidate');
    if (revalidateActions === undefined) return;
    for (const action of revalidateActions) {
      this.fireAction(action);
    }
  }

  /**
   * Runtime re-entrancy depth counter bounding chained `xforms-value-changed`
   * action cascades (design ADR-2). Static DAG cycle detection (finalizeDag)
   * cannot see actions — they are not DAG vertices (ADR-1) — so a build-time
   * "Cycle detected" check never fires for an action-only cycle (action A's
   * write cascades into action B, whose write cascades back into A, etc.).
   * fireAction increments this before its own triggerTriggerables call and
   * decrements it in a finally block, so the counter reflects chain DEPTH
   * (nesting), not breadth (sibling actions fired from the same tail do not
   * accumulate against each other).
   */
  private actionChainDepth = 0;

  /** sdd/setvalue-actions PR3, design ADR-2: fail-loud bound for chained actions. */
  private static readonly MAX_ACTION_CHAIN_DEPTH = 16;

  /**
   * Evaluate a single setvalue action's value expression (or literal),
   * write the typed result into its target node, then propagate through the
   * standard DAG cascade.
   *
   * Mirrors JavaRosa Action.processAction -> setValue -> triggerTriggerables
   * (design section 4). Bypasses answerQuestion's constraint gating on
   * purpose (ADR-3) — action writes are not user-entered answers.
   *
   * sdd/setvalue-actions PR3: tracks/enforces the MAX_ACTION_CHAIN_DEPTH
   * re-entrancy guard (ADR-2) — throws fail-loud once a chain of
   * value-changed actions triggering each other exceeds the bound, rather
   * than looping indefinitely or silently truncating (spec Requirement 7).
   */
  private fireAction(action: SetValueAction, contextNode?: InstanceNode | null): void {
    this.actionChainDepth++;
    try {
      if (this.actionChainDepth > FormEvaluator.MAX_ACTION_CHAIN_DEPTH) {
        throw new Error(
          `setvalue action chain exceeded max depth ${FormEvaluator.MAX_ACTION_CHAIN_DEPTH} ` +
            `(possible cycle) at ${action.sourceLocation}`,
        );
      }
      this.fireActionInner(action, contextNode);
    } finally {
      this.actionChainDepth--;
    }
  }

  /**
   * Resolves `action.targetExpr` at fire time via the XPath seam
   * (`evaluateTyped` → NODESET), replacing the pre-parity parse-time
   * `TreeReference`-based lookup. Design Decisions 2/3 (sdd/setvalue-parity):
   * a target that resolves to 0 or >1 nodes, or to a non-NODESET result, now
   * throws fail-loud instead of silently no-op'ing (accepted breaking change,
   * no deprecation path).
   */
  private fireActionInner(action: SetValueAction, contextNode?: InstanceNode | null): void {
    const hostNode =
      contextNode !== undefined
        ? contextNode
        : action.hostRef !== null
          ? resolveReference(this.tree, action.hostRef)
          : null;
    const ctx = this.makeContext(hostNode);
    const result = action.targetExpr.evaluateTyped(ctx);

    if (result.type !== 'NODESET') {
      throw new Error(
        `setvalue: target ref '${action.targetSource}' did not evaluate to a nodeset (${action.sourceLocation})`,
      );
    }
    if (result.nodes.length === 0) {
      throw new Error(
        `setvalue: target ref '${action.targetSource}' resolved to no nodes (${action.sourceLocation})`,
      );
    }
    if (result.nodes.length > 1) {
      throw new Error(
        `setvalue: target ref '${action.targetSource}' resolved to ${result.nodes.length} nodes; ` +
          `a setvalue target must be a single node (${action.sourceLocation})`,
      );
    }

    const targetXPathNode = result.nodes[0]!;
    if (targetXPathNode.kind !== 'element') {
      throw new Error(
        `setvalue: target ref '${action.targetSource}' did not resolve to an element node (${action.sourceLocation})`,
      );
    }
    const targetNode = targetXPathNode.node;

    let rawString: string;
    if (action.expr !== null) {
      const rawResult = this.evaluateExprFast(action.expr, targetNode);
      rawString =
        typeof rawResult === 'string'
          ? rawResult
          : typeof rawResult === 'number'
            ? String(rawResult)
            : rawResult
              ? '1'
              : '0';
    } else {
      rawString = action.literal ?? '';
    }

    targetNode.value = cast(targetNode.dataType, rawString);
    const writtenRef = this.nodeToRef(this.wrap(targetNode));
    if (writtenRef !== null) {
      this.triggerTriggerables(writtenRef);
    }
  }

  /**
   * Evaluate a Recalculate triggerable and write the result to its target nodes.
   *
   * Uses resolveAll to handle repeated nodes — each instance of the target path
   * gets its own recalculate evaluation with that instance as the context node.
   *
   * Context selection mirrors JavaRosa Recalculate.apply:
   *   - contextNode = the target node (resolved from triggerable.originalContextRef
   *     contextualized against changedRef when provided).
   *   - Result is coerced to target node's dataType via cast(dataType, string(result)).
   *
   * Slice 3.5: if the target node's parent(s) are non-relevant, effective value
   * is '' — but we still compute and write (JavaRosa: calculates fire even inside
   * non-relevant groups; only descendant nodes that depend on a non-relevant node
   * see '' via the relevanceOf closure).
   */
  private applyRecalculate(t: Triggerable & { kind: 'recalculate' }, changedRef: TreeReference | null, subtreeRoot: InstanceNode | null = null): void {
    for (const target of t.targets) {
      let targetNodes: InstanceNode[];
      if (subtreeRoot !== null) {
        // Fix B: scope the resolve to the subtree instead of a full-tree BFS +
        // post-filter. resolveAllWithin starts from subtreeRoot and walks only
        // the suffix of the absolute target ref — O(subtree) instead of O(tree).
        targetNodes = resolveAllWithin(this.tree, subtreeRoot, target);
      } else if (changedRef !== null && isSafeToContextualize(t, target)) {
        // Fix C: contextualize the resolve to the deepest concrete ancestor shared
        // with changedRef — mirrors JavaRosa Triggerable.contextualize. Safe only
        // when no trigger of this triggerable is an ancestor of the target (i.e.,
        // the triggerable reacts to a sibling/cousin, not a parent-count change).
        // An empty result means "no nodes in THIS context" — do NOT fall back to
        // resolveReference (which picks DEFAULT_MULTIPLICITY and writes to the wrong instance).
        targetNodes = resolveAllContextualized(this.tree, target, changedRef);
      } else {
        targetNodes = resolveAll(this.tree, target);
        if (targetNodes.length === 0) {
          const single = resolveReference(this.tree, target);
          if (single !== null) targetNodes.push(single);
        }
      }
      // Optimization: if the expression is context-independent (uses only absolute
      // paths — no '..', no position(), no self) then all target nodes would produce
      // the same value. Evaluate once using the first node and broadcast to all.
      if (targetNodes.length > 1 && isContextIndependent(t.expr.source)) {
        const firstNode = targetNodes[0]!;
        const rawResult = this.evaluateExprFast(t.expr, firstNode);
        const rawString = typeof rawResult === 'string' ? rawResult : typeof rawResult === 'number' ? String(rawResult) : rawResult ? '1' : '0';
        const v = cast(firstNode.dataType, rawString);
        for (const targetNode of targetNodes) { targetNode.value = v; }
      } else {
        for (const targetNode of targetNodes) {
          const rawResult = this.evaluateExprFast(t.expr, targetNode);
          const rawString = typeof rawResult === 'string' ? rawResult : typeof rawResult === 'number' ? String(rawResult) : rawResult ? '1' : '0';
          targetNode.value = cast(targetNode.dataType, rawString);
        }
      }
    }
  }

  private evaluateExprFast(compiled: CompiledInstanceExpression, ctx: InstanceNode): string | number | boolean {
    if (compiled.source === 'position(..)') {
      const p = ctx.parent;
      if (p !== null) {
        const s = p.children.filter((c) => c.name === ctx.name && c.multiplicity !== INDEX_TEMPLATE);
        return s.indexOf(ctx) + 1;
      }
      return 1;
    }
    return this.evaluateCompiled(compiled, ctx);
  }

  /**
   * Recalculate a triggerable whose triggers are all outside the newly
   * created repeat subtree.
   *
   * Deliberately full-tree (NOT scoped to subtreeRoot, unlike
   * applyRecalculate's Fix B): when an outside trigger changes (e.g. an
   * absolute count() used by every repeat instance), adding one new
   * instance must re-propagate the new value to ALL existing sibling
   * instances too, not just the new one — see the
   * "count(/data/repeat) outside is propagated to inner-count after add
   * and remove" equivalence test.
   *
   * The one broadcast (evaluate once, copy to every same-grandparent node)
   * is safe ONLY when isContextIndependent(t.expr.source) is true — i.e.
   * the expression has no relative/position dependency, so every target
   * node would evaluate to the exact same value anyway (mirrors
   * applyRecalculate's own context-independent broadcast optimization).
   * Without this guard, a position()/`..`-relative expression (e.g. a
   * calculate that distributes an outside select-multi's items across
   * repeat instances via `selected-at(x, position(..)-1)`) would have one
   * instance's value silently copied onto every other same-grandparent
   * instance — each instance must instead be evaluated in its own context.
   */
  private applyRecalculateGrouped(t: Triggerable & { kind: 'recalculate' }, subtreeRoot: InstanceNode): void {
    void subtreeRoot; // retained for call-site symmetry with applyRecalculate; intentionally unused — see full-tree rationale above.
    for (const target of t.targets) {
      const nodes = resolveAll(this.tree, target);
      if (nodes.length <= 1) {
        for (const n of nodes) {
          const r = this.evaluateExprFast(t.expr, n);
          n.value = cast(n.dataType, String(r));
        }
        continue;
      }

      if (!isContextIndependent(t.expr.source)) {
        for (const n of nodes) {
          const r = this.evaluateExprFast(t.expr, n);
          n.value = cast(n.dataType, String(r));
        }
        continue;
      }

      const byGp = new Map<InstanceNode, InstanceNode[]>();
      for (const n of nodes) {
        const gp = n.parent?.parent ?? null;
        if (gp === null) {
          const r = this.evaluateExprFast(t.expr, n);
          n.value = cast(n.dataType, String(r));
          continue;
        }
        let g = byGp.get(gp);
        if (!g) {
          g = [];
          byGp.set(gp, g);
        }
        g.push(n);
      }
      for (const group of byGp.values()) {
        const f = group[0]!;
        const raw = this.evaluateExprFast(t.expr, f);
        const s = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : raw ? '1' : '0';
        const v = cast(f.dataType, s);
        for (const n of group) n.value = v;
      }
    }
  }

  /**
   * For multi-instance conditions, evaluate the predicate expression scoped to
   * each concrete parent — not the document root.
   *
   * JavaRosa evaluates each triggerable's expression once per affected concrete node
   * using that node's concrete context (EvaluationContext with the concrete ref).
   * For position()-dependent expressions this must be done as a child-step predicate
   * from the parent so position() returns the node's position among same-name siblings.
   *
   * Algorithm:
   *   1. Group targetNodes by their parent InstanceNode (concrete parent).
   *   2. For each unique parent, evaluate `{nodeName}[{exprSource}]` with the parent
   *      as the context node — this is a child-axis step with the predicate.
   *   3. Collect all nodes in the result nodeset into the returned Set.
   *
   * This correctly handles:
   *   - `position() > 2` on top-level repeats (parent = /data, position is 1-based among siblings)
   *   - `../consent = 'yes'` on nested repeats (parent = concrete /data/household[N], so `..`
   *     resolves to that specific household — no cross-household leakage)
   */
  private evaluateRelevantSetByConcreteParent(
    targetNodes: InstanceNode[],
    compiled: CompiledInstanceExpression,
    exprSource: string,
  ): Set<InstanceNode> {
    const relevantNodes = new Set<InstanceNode>();

    // Group nodes by parent
    const nodesByParent = new Map<InstanceNode, InstanceNode[]>();
    for (const node of targetNodes) {
      const parent = node.parent;
      if (parent === null) {
        // No parent — fall back to single-node evaluation
        const raw = this.evaluateCompiled(compiled, node);
        if (toBoolean(raw)) {
          relevantNodes.add(node);
        }
        continue;
      }
      let group = nodesByParent.get(parent);
      if (group === undefined) {
        group = [];
        nodesByParent.set(parent, group);
      }
      group.push(node);
    }

    // For each concrete parent, evaluate nodeName[expr] from that parent context
    for (const [parent, nodes] of nodesByParent) {
      const nodeName = nodes[0]!.name;
      // Evaluate "nodeName[expr]" with parent as context
      // This gives each node its correct position() within the parent's children
      const parentCtx = this.makeContext(parent);
      const stepExpr = `${nodeName}[${exprSource}]`;
      const result = evaluateInstanceExpr(stepExpr, parentCtx.contextNode, XPATH_EVALUATION_RESULT.ANY_TYPE);
      let xpathNode = result.iterateNext();
      while (xpathNode !== null) {
        if (xpathNode.kind === 'element') {
          relevantNodes.add(xpathNode.node);
        }
        xpathNode = result.iterateNext();
      }
    }

    return relevantNodes;
  }

  /**
   * Evaluate a Condition triggerable and update NodeState for its target nodes.
   *
   * Uses resolveAll to handle repeated nodes — each instance of the target path
   * gets its own condition evaluation with that instance as the context node.
   * NodeState is stored per concrete instance (with position-specific key) when
   * multiple instances exist; single instances use the genericized key.
   *
   * Mirrors JavaRosa Condition.apply (Condition.java).
   * Action semantics:
   *   relevant  → state.relevant = boolean(result); then propagate inherited relevance
   *   required  → state.required = boolean(result)
   *   readonly  → state.readonly = boolean(result); state.enabled = !state.readonly
   *
   * After updating own relevant, propagates inherited relevance to descendants
   * (ancestor walk semantics: a node is non-relevant if any ancestor is non-relevant).
   */
  private applyCondition(t: Triggerable & { kind: 'condition' }, changedRef: TreeReference | null, subtreeRoot: InstanceNode | null = null): void {
    for (const target of t.targets) {
      let targetNodes: InstanceNode[];
      if (subtreeRoot !== null) {
        // Fix B: scope resolve to subtree — same rationale as applyRecalculate.
        targetNodes = resolveAllWithin(this.tree, subtreeRoot, target);
      } else if (changedRef !== null && isSafeToContextualize(t, target)) {
        // Fix C: safe contextualization — same guard as applyRecalculate.
        // An empty result means "no nodes in THIS context" — do NOT fall back to
        // resolveReference (which picks DEFAULT_MULTIPLICITY and writes to the wrong instance).
        targetNodes = resolveAllContextualized(this.tree, target, changedRef);
      } else {
        targetNodes = resolveAll(this.tree, target);
        if (targetNodes.length === 0) {
          const single = resolveReference(this.tree, target);
          if (single !== null) targetNodes.push(single);
        }
      }

      // Determine generic key for this target (used for backward-compat lookup)
      const genericKey = refToString(genericize(target));
      const hasMultipleInstances = targetNodes.length > 1;

      // For multi-instance relevant conditions, pre-compute a relevant set by evaluating
      // the predicate from each concrete parent context. This mirrors JavaRosa's behavior
      // where each triggerable is evaluated with a per-instance context:
      //   contextRef.contextualize(qualified) → EvaluationContext(parentContext, concreteRef)
      //   expr.eval(instance, ec)
      //
      // We use the predicate approach (parentPath/nodeName[expr]) so that position()
      // is correct (position within the parent's children of that name), while keeping
      // the context scoped to the concrete parent — fixing the cross-instance scoping bug
      // for nested repeats (e.g. /data/household/child_repeat where ../consent differs
      // per household).
      let relevantSetForTarget: Set<InstanceNode> | null = null;
      if (hasMultipleInstances && t.action === 'relevant') {
        relevantSetForTarget = this.evaluateRelevantSetByConcreteParent(targetNodes, t.expr, t.expr.source);
      }

      for (const targetNode of targetNodes) {
        let boolResult: boolean;
        if (relevantSetForTarget !== null) {
          boolResult = relevantSetForTarget.has(targetNode);
        } else {
          const rawResult = this.evaluateCompiled(t.expr, targetNode);
          boolResult = toBoolean(rawResult);
        }

        // Store state under BOTH the concrete key (for per-instance lookup) AND
        // the generic key (for backward-compat single-instance lookup in isEffectivelyRelevant).
        const concreteRef = this.nodeToRef(wrapInstanceNode(targetNode, this.docNode));
        const concreteKey = concreteRef !== null ? refToString(concreteRef) : genericKey;

        const concreteState = this.getOrCreateState(concreteKey);

        // For single-instance (non-repeat) paths, concrete key = generic key effectively
        // (both are the same since there's only one instance). For multi-instance paths,
        // also update the generic state to track the last-evaluated value (for backward compat).
        const state = concreteState;

        switch (t.action) {
          case 'relevant':
            state.relevant = boolResult;
            if (hasMultipleInstances) {
              // For multi-instance: also update generic key with this result
              // (last write wins — only meaningful if all instances have same relevance)
              const genericState = this.getOrCreateState(genericKey);
              genericState.relevant = boolResult;
            } else {
              // Single instance: ensure generic key = concrete state (same object or same value)
              if (concreteKey !== genericKey) {
                const genericState = this.getOrCreateState(genericKey);
                genericState.relevant = boolResult;
              }
            }
            // Propagate inherited relevance through descendants
            this.propagateRelevanceToDescendants(targetNode);
            break;
          case 'required':
            state.required = boolResult;
            if (concreteKey !== genericKey) {
              this.getOrCreateState(genericKey).required = boolResult;
            }
            break;
          case 'readonly':
            state.readonly = boolResult;
            state.enabled = !boolResult;
            if (concreteKey !== genericKey) {
              const g = this.getOrCreateState(genericKey);
              g.readonly = boolResult;
              g.enabled = !boolResult;
            }
            break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Slice 3.6 — Constraint validation + answerQuestion + validate()
  // ---------------------------------------------------------------------------

  /**
   * Answer a question with constraint checking.
   *
   * Algorithm (mirrors JavaRosa FormEntryController.answerQuestion):
   *   1. If value is non-null AND a constraint binding exists for ref:
   *      evaluate constraint in context of ref; if false → CONSTRAINT_VIOLATED (no commit).
   *   2. Empty/null value → constraint always satisfied (skip eval).
   *   3. setValue(ref, value) + triggerTriggerables(ref).
   *   4. Return OK.
   */
  answerQuestion(ref: TreeReference, value: AnswerValue | null): AnswerResult {
    const nodeset = refToString(ref);

    // Rank permutation check — intrinsic well-formedness, runs before any
    // author constraint and before commit. Sibling to the constraint block,
    // never inside it (see sdd/rank-validation design §3.1).
    const rankResult = this.checkRank(ref, value);
    if (rankResult !== null && !rankResult.valid) {
      return AnswerResult.RANK_INVALID;
    }

    const constraintCb = this.constraintBindings.get(nodeset);

    // Non-null value with a constraint → evaluate constraint
    if (value !== null && constraintCb !== undefined) {
      const targetNode = resolveReference(this.tree, ref);
      if (targetNode !== null) {
        // Temporarily set value so "." evaluates to the candidate value
        const previousValue = targetNode.value;
        targetNode.value = value;
        let constraintResult: string | number | boolean;
        try {
          constraintResult = this.evaluateCompiled(constraintCb.expr, targetNode);
        } finally {
          // Restore previous value (we do NOT commit if constraint fails)
          targetNode.value = previousValue;
        }
        if (!toBoolean(constraintResult)) {
          return AnswerResult.CONSTRAINT_VIOLATED;
        }
      }
    }

    // Constraint satisfied (or empty value) → commit
    this.setValue(ref, value);
    this.triggerTriggerables(ref);
    return AnswerResult.OK;
  }

  /**
   * Full-form validation sweep.
   *
   * Mirrors JavaRosa TriggerableDag.validate() (TriggerableDag.java:409-439).
   * Iterates all bindings in the NodeState map order, checking:
   *   1. effectivelyRelevant && required && value empty → REQUIRED_BUT_EMPTY
   *   2. non-null value && constraint binding exists → eval constraint → CONSTRAINT_VIOLATED
   *
   * Returns the first failure, or null if the form is valid.
   */
  validate(
    allNodesets: readonly string[],
  ): ValidateOutcome | null {
    for (const nodeset of allNodesets) {
      const ref = parseAbsoluteRef(nodeset);
      const node = resolveReference(this.tree, ref);
      if (node === null) continue;

      const stateKey = refToString(genericize(ref));
      const state = this.nodeStates.get(stateKey);
      const isRelevant = this.isEffectivelyRelevant(ref);

      // Check required: effectively relevant + required + empty value
      if (isRelevant && state?.required === true && isAnswerEmpty(node.value)) {
        return { failedNodeset: nodeset, status: AnswerResult.REQUIRED_BUT_EMPTY };
      }

      // Check rank permutation: after required, before constraint.
      const rankResult = this.checkRank(ref, node.value);
      if (rankResult !== null && !rankResult.valid) {
        return { failedNodeset: nodeset, status: AnswerResult.RANK_INVALID };
      }

      // Check constraint: non-null, non-empty value with a constraint binding
      const constraintCb = this.constraintBindings.get(nodeset);
      if (constraintCb !== undefined && !isAnswerEmpty(node.value)) {
        const constraintResult = this.evaluateCompiled(constraintCb.expr, node);
        if (!toBoolean(constraintResult)) {
          return { failedNodeset: nodeset, status: AnswerResult.CONSTRAINT_VIOLATED };
        }
      }
    }
    return null;
  }

  /**
   * Initialize a newly added repeat instance by running all triggerables
   * whose targets are under the given repeat root ref.
   *
   * Mirrors JavaRosa TriggerableDag.initializeTriggerables called on a new
   * repeat instance: re-evaluates all DAG triggerables in topological order,
   * allowing those that target the new instance to fire.
   *
   * Called from Scenario.createNewRepeat after adding the node to the tree.
   *
   * @param repeatRootRef  The concrete positional ref of the new repeat instance
   *                       (e.g. /data/repeat[1], multiplicity=1)
   */
  initializeRepeatInstance(repeatRootRef: TreeReference): void {
    if (this.dag === null) return;

    const subtreeRoot = resolveReference(this.tree, repeatRootRef);
    const rootGeneric = refToString(genericize(repeatRootRef));
    const subtreePrefix = rootGeneric + '/';

    // --- sdd/setvalue-parity PR3 (Layer C): jr-insert / odk-new-repeat fire
    // points, dispatched BEFORE the DAG cascade below (design data-flow
    // diagram, JavaRosa FormDef.createNewRepeat 534-539 oracle finding).
    // jr-insert is model-level only (hostRef === null by parse-time gating,
    // design Decision 5) and fires first. odk-new-repeat then fires both at
    // model level (hostRef === null) AND scoped to the new instance's own
    // subtree (hostRef nested inside the repeat template) — JavaRosa fires
    // odk-new-repeat on both the form-level controller and the new repeat's
    // own controller; ts-rosa has no separate per-instance controller, so the
    // "own controller" firing is modeled as contextNode = subtreeRoot.
    if (this.actionRegistry !== null) {
      const registry = this.actionRegistry;

      for (const action of registry.byEvent.get('jr-insert') ?? []) {
        this.fireAction(action);
      }

      for (const action of registry.byEvent.get('odk-new-repeat') ?? []) {
        if (action.hostRef === null) {
          this.fireAction(action);
        }
      }

      for (const [scopeKey, scopedActions] of registry.newRepeatByScope) {
        if (scopeKey !== rootGeneric && !scopeKey.startsWith(subtreePrefix)) continue;
        for (const action of scopedActions) {
          // action.hostRef is guaranteed non-null for newRepeatByScope entries.
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const hostRef = action.hostRef!;
          const hostNode =
            subtreeRoot !== null
              ? (resolveAllWithin(this.tree, subtreeRoot, hostRef)[0] ?? subtreeRoot)
              : null;
          this.fireAction(action, hostNode);
        }
      }
    }

    // --- Fix A: prune triggerables to those relevant to the new subtree ---
    // A triggerable is relevant to a new repeat instance if:
    //   (a) any of its TARGETS fall inside the subtree (needs initialization), OR
    //   (b) any of its TRIGGERS fall inside the subtree (reacts to the new instance).
    // Triggerables with both triggers AND targets entirely outside the subtree
    // cannot affect the new instance — skipping them is the key O(N²→N) improvement.
    // We expand transitively via immediateCascades so ordering is preserved.
    const subtreeRoots = new Set<Triggerable>();
    for (const triggerable of this.dag.triggerablesDAG) {
      const hasTargetInSubtree = triggerable.targets.some((tgt) => {
        const k = refToString(tgt);
        return k === rootGeneric || k.startsWith(subtreePrefix);
      });
      const hasTriggerInSubtree = triggerable.triggers.some((tr) => {
        const k = refToString(tr);
        return k === rootGeneric || k.startsWith(subtreePrefix);
      });
      if (hasTargetInSubtree || hasTriggerInSubtree) {
        subtreeRoots.add(triggerable);
      }
    }
    const toTrigger = getAllToTrigger(subtreeRoots, this.dag.immediateCascades);
    // --- end Fix A ---

    for (const triggerable of this.dag.triggerablesDAG) {
      if (!toTrigger.has(triggerable)) continue;

      if (triggerable.kind === 'recalculate') {
        const hasTriggers = triggerable.triggers.length > 0;
        const allInside = hasTriggers && triggerable.triggers.every(
          (t) => refToString(t).startsWith(subtreePrefix));
        const allOutside = hasTriggers && triggerable.triggers.every((t) => {
          const k = refToString(t);
          return k !== rootGeneric && !k.startsWith(subtreePrefix);
        });
        if (allInside) {
          this.applyRecalculate(triggerable, repeatRootRef, subtreeRoot);
        } else if (allOutside && subtreeRoot !== null) {
          this.applyRecalculateGrouped(triggerable, subtreeRoot);
        } else {
          this.applyRecalculate(triggerable, repeatRootRef, null);
        }
      } else if (triggerable.kind === 'condition') {
        this.applyCondition(triggerable, repeatRootRef, subtreeRoot);
      }
    }
  }

  /**
   * Re-trigger all triggerables that depend on nodes within the given repeat
   * path. Called after a repeat instance is removed to update counts, cascades, etc.
   *
   * @param genericRepeatRef  The genericized ref of the repeat (e.g. /data/repeat)
   */
  triggerRepeatRemoval(genericRepeatRef: TreeReference): void {
    if (this.dag === null) return;

    // Find all triggerables whose triggers include the repeat ref or its children
    const genericKey = refToString(genericRepeatRef);
    const cascadeRoots = this.dag.triggerablesPerTrigger.get(genericKey);
    if (cascadeRoots && cascadeRoots.size > 0) {
      this.triggerTriggerables(genericRepeatRef);
    }

    // Also re-run all triggerables in DAG order to handle count() etc.
    for (const triggerable of this.dag.triggerablesDAG) {
      if (triggerable.kind === 'recalculate') {
        this.applyRecalculate(triggerable, genericRepeatRef);
      } else if (triggerable.kind === 'condition') {
        this.applyCondition(triggerable, genericRepeatRef);
      }
    }
  }

  /**
   * Walk all descendant InstanceNodes of a node and ensure their effective
   * relevance is consistent with the ancestor walk rule.
   *
   * This does NOT set state.relevant on descendants — only own NodeState.relevant
   * reflects the Condition expression result. Effective relevance is always
   * computed on-the-fly by isEffectivelyRelevant (ancestor walk).
   *
   * This method exists to trigger any downstream recalculates that depend on
   * nodes inside the subtree (via a future event system). For now it is a no-op
   * beyond the ancestor walk built into isEffectivelyRelevant.
   *
   * NOTE (spec S3.5): calculates inside a non-relevant group STILL fire — but
   * descendants that depend on a non-relevant node see '' via relevanceOf closure.
   */
  private propagateRelevanceToDescendants(_node: InstanceNode): void {
    // Effective relevance is computed lazily via isEffectivelyRelevant — no
    // explicit propagation needed. This method is a hook for future event emission.
  }
}

// ---------------------------------------------------------------------------
// getAllToTrigger — transitive expansion via immediateCascades
// ---------------------------------------------------------------------------

/**
 * Mirrors JavaRosa TriggerableDag.getAllToTrigger (TriggerableDag.java:503-523).
 */
function getAllToTrigger(
  cascadeRoots: ReadonlySet<Triggerable>,
  immediateCascades: ReadonlyMap<Triggerable, Set<Triggerable>>,
): Set<Triggerable> {
  const toTrigger = new Set<Triggerable>();
  const queue: Triggerable[] = [...cascadeRoots];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (toTrigger.has(current)) continue;
    toTrigger.add(current);

    const downstream = immediateCascades.get(current);
    if (downstream) {
      for (const dep of downstream) {
        if (!toTrigger.has(dep)) {
          queue.push(dep);
        }
      }
    }
  }

  return toTrigger;
}

// ---------------------------------------------------------------------------
// isSafeToContextualize — guard for Fix C contextualization in apply{Recalculate,Condition}
// ---------------------------------------------------------------------------

/**
 * Aggregate function names that can read across repeat instances when used with
 * an absolute or non-prefix path argument. If any of these appear in the expression
 * source, we conservatively decline to contextualize.
 */
const AGGREGATE_FUNCTIONS = /\b(count|sum|max|min|avg|count-non-empty)\s*\(/;

/**
 * Returns true when an expression's value is INDEPENDENT of evaluation context —
 * i.e., it produces the same result no matter which InstanceNode is the context.
 *
 * Used to optimize the cross-instance aggregate case: when the expression is
 * context-independent, we can evaluate once using any target node and broadcast
 * the result to all target nodes — avoiding O(N) redundant evaluations when
 * the expression uses only absolute paths and no context-relative steps.
 *
 * Implementation: structural token-walk using the project's XPath tokenizer so
 * that word-operators (div/mod/and/or) and the @ axis are disambiguated correctly
 * by the same §3.7 rules the evaluator uses — no regex string-scanning.
 *
 * Returns false (err toward dependent = correct) for anything that cannot be
 * structurally classified as context-free.
 */
function isContextIndependent(src: string): boolean {
  let tokens;
  try {
    tokens = tokenize(src);
  } catch {
    // Unparseable expression — fail closed (dependent).
    return false;
  }

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const prev = i > 0 ? tokens[i - 1]! : null;
    const next = i < tokens.length - 1 ? tokens[i + 1]! : null;

    switch (tok.kind) {
      // .. — parent axis shorthand
      case TokenKind.DOTDOT:
        return false;

      // . — self/context node
      case TokenKind.DOT:
        return false;

      // @ — attribute axis shorthand
      case TokenKind.AT:
        return false;

      // current(), position(), last() — always context-dependent.
      // name(), local-name(), namespace-uri(), string(), number(),
      // normalize-space(), string-length() — context-dependent in their
      // zero-argument form (they implicitly operate on the context node).
      // Blocked unconditionally: over-blocking the rare arg form
      // (e.g. name(/abs/path)) only costs a perf miss (falls back to
      // per-instance eval), which is correctness-safe.
      case TokenKind.FUNCTION_NAME:
        if (
          tok.text === 'current' ||
          tok.text === 'position' ||
          tok.text === 'last' ||
          tok.text === 'name' ||
          tok.text === 'local-name' ||
          tok.text === 'namespace-uri' ||
          tok.text === 'string' ||
          tok.text === 'number' ||
          tok.text === 'normalize-space' ||
          tok.text === 'string-length'
        )
          return false;
        break;

      // Named axis (ancestor::, self::, parent::, descendant::, attribute::, etc.)
      // AXIS_NAME tokens are always context-dependent — the tokenizer only emits
      // AXIS_NAME when the token is followed by '::'.
      case TokenKind.AXIS_NAME:
        return false;

      // NAME token: a relative path step UNLESS it is preceded by / or //
      // (absolute child step) or followed by ( (function call).
      case TokenKind.NAME: {
        const precededBySlash =
          prev !== null &&
          (prev.kind === TokenKind.SLASH || prev.kind === TokenKind.SLASHSLASH);
        const followedByLparen =
          next !== null && next.kind === TokenKind.LPAREN;
        if (!precededBySlash && !followedByLparen) return false;
        break;
      }

      // node()/text()/comment()/processing-instruction() as a relative step.
      // NODE_TYPE is only context-dependent when used as a step — i.e. NOT
      // preceded by / or //, which would make it an absolute step.
      case TokenKind.NODE_TYPE: {
        const precededBySlash =
          prev !== null &&
          (prev.kind === TokenKind.SLASH || prev.kind === TokenKind.SLASHSLASH);
        if (!precededBySlash) return false;
        break;
      }

      // * (WILDCARD) and ns:* (PREFIXED_WILDCARD) as a relative name-test step.
      // Context-dependent unless preceded by / or //, which makes it an
      // absolute child step (e.g. /data/rep/* is safe).
      case TokenKind.WILDCARD:
      case TokenKind.PREFIXED_WILDCARD: {
        const precededBySlash =
          prev !== null &&
          (prev.kind === TokenKind.SLASH || prev.kind === TokenKind.SLASHSLASH);
        if (!precededBySlash) return false;
        break;
      }

      default:
        break;
    }
  }

  return true;
}

/** @internal — exported for unit tests only; do NOT use in production code. */
export { isContextIndependent as TESTONLY_isContextIndependent };

/**
 * Returns true when it is safe to use resolveAllContextualized (scope target resolution
 * to the deepest concrete ancestor shared with changedRef) for a triggerable/target pair.
 *
 * WHITELIST (positive): returns true ONLY when the expression is provably confined
 * to the concrete subtree of the changed node. Fails CLOSED — anything not
 * explicitly safe returns false and falls back to the always-correct global resolveAll.
 *
 * Safe conditions (ALL must hold):
 *   (a) No trigger is a proper prefix of the target — i.e. no "fired from above"
 *       (repeat-count change) pattern.
 *   (b) Expression source contains NO absolute path marker (leading `/` that is
 *       NOT part of `//`, OR a bare `//`).
 *   (c) Expression source contains NO `//` (descendant-or-self axis).
 *   (d) Expression source contains NO aggregate function (count/sum/max/min/etc.).
 *   (e) Expression source contains NO `current()`.
 *   (f) Expression source contains NO non-child/parent named axis
 *       (ancestor::, descendant::, following-sibling::, preceding-sibling::,
 *        following::, preceding::, namespace::, attribute::).
 *
 * String heuristic only — no structured AST available (CompiledInstanceExpression
 * exposes only `source`). Errs toward false (correctness over performance).
 *
 * The safe case is expressions like `if(../consent='yes',...)` on target
 * `/data/household/child_repeat/field` triggered by `/data/household/consent`:
 * uses only relative paths confined to the concrete sibling → safe to contextualize.
 */
function isSafeToContextualize(t: Triggerable, target: TreeReference): boolean {
  const targetStr = refToString(target);
  for (const trigger of t.triggers) {
    const trigStr = refToString(trigger);
    // (a) A trigger that is a proper prefix of the target path means the triggerable
    // is "fired from above" (e.g. repeat-count change) → not safe to contextualize.
    if (targetStr.startsWith(trigStr + '/') || targetStr === trigStr) {
      return false;
    }
  }

  const src = t.expr.source;

  // (c) descendant-or-self axis — always crosses instance boundaries
  if (src.includes('//')) return false;

  // (d) aggregate function whose argument contains a relative path step (`..`).
  // A relative step inside an aggregate means the aggregate value DIFFERS per
  // repeat instance (e.g. count(/data/hh/child[../consent='yes']) counts children
  // filtered by THEIR household's consent). Contextualizing would update only the
  // changed household, leaving others with stale counts.
  // Aggregates with ONLY absolute arguments are context-independent (same result
  // for every instance) and are safe to contextualize.
  if (AGGREGATE_FUNCTIONS.test(src) && src.includes('..')) return false;

  // (e) current() references the context node explicitly — context-sensitive in a
  // way our contextualization doesn't account for
  if (/\bcurrent\s*\(\s*\)/.test(src)) return false;

  // (f) named axes other than child (default) and parent (..)
  if (/\b(ancestor|descendant|following-sibling|preceding-sibling|following|preceding|namespace|attribute)\s*::/.test(src)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// isAnswerEmpty — null or empty-string AnswerValue is "empty" for required/constraint
// ---------------------------------------------------------------------------

/**
 * Returns true if an AnswerValue is considered empty for validation purposes.
 * Mirrors JavaRosa: null or empty string value = empty.
 */
function isAnswerEmpty(value: AnswerValue | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  // String-like types: empty if value === ''
  if (typeof value.value === 'string') return value.value === '';
  // Arrays (selectMulti, geoshape, geotrace): empty if length === 0
  if (Array.isArray(value.value)) return value.value.length === 0;
  // Numbers, booleans, Dates: never empty (0 and false are valid answers)
  return false;
}

// ---------------------------------------------------------------------------
// toBoolean — mirrors JavaRosa XPathFuncExpr.toBoolean / boolean() coercion
// ---------------------------------------------------------------------------

function toBoolean(value: string | number | boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  // string: 'true' or '1' are true; '' or '0' or 'false' are false (JavaRosa rules)
  const s = value.trim().toLowerCase();
  return s === 'true' || s === '1';
}
