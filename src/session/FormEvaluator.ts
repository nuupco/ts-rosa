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
import type { InstanceNode } from '../model/instance/InstanceNode.ts';
import {
  makeInstanceDocumentNode,
  wrapInstanceNode,
  setActiveRelevanceCheck,
  XPATH_EVALUATION_RESULT,
  evaluateInstanceExpr,
  type InstanceDocumentNode,
  type InstanceXPathNode,
  type InstanceEvaluationContext,
  type CompiledInstanceExpression,
} from '../xpath/seam/XPathSeam.ts';
import type { TriggerableDag } from '../eval/TriggerableDag.ts';
import type { Triggerable } from '../eval/Triggerable.ts';
import type { TreeReference } from '../model/instance/TreeReference.ts';
import { genericize, refToString, parentOf, parseAbsoluteRef, REF_ABSOLUTE } from '../model/instance/TreeReference.ts';
import { level } from '../model/instance/TreeReferenceLevel.ts';
import { INDEX_TEMPLATE, INDEX_UNBOUND } from '../model/instance/multiplicity.ts';
import { resolveReference, resolveAll } from '../model/instance/InstanceTree.ts';
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
import { getTriggers } from '../eval/getTriggers.ts';
import { AnswerResult } from './AnswerResult.ts';

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
  readonly status: AnswerResult.REQUIRED_BUT_EMPTY | AnswerResult.CONSTRAINT_VIOLATED;
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

    // Evaluate nodesetExpr as ANY_TYPE (nodeset)
    const result = evaluateInstanceExpr(
      itemset.nodesetExpr,
      ctx.contextNode,
      XPATH_EVALUATION_RESULT.ANY_TYPE,
    );

    // Collect result nodes
    const choices: SelectChoice[] = [];
    let node = result.iterateNext();
    while (node !== null) {
      if (node.kind === 'element') {
        const value = this.evaluateRelativeOnNode(itemset.valueExpr, node);
        const label = this.resolveChoiceLabel(itemset, node);
        choices.push({ value, label });
      }
      node = result.iterateNext();
    }

    // Store and return
    const frozen = Object.freeze(choices);
    this.choiceCache.set(refKey, { triggerSig, choices: frozen });
    return frozen;
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
    const refKey = refToString(ref);
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
    // Check CONCRETE key first (per-instance state), then generic key (single-instance state).
    let current: TreeReference = ref;
    while (current.levels.length > 0) {
      // Try concrete key (with positional multiplicity) first
      const concreteKey = refToString(current);
      const concreteState = this.nodeStates.get(concreteKey);
      if (concreteState !== undefined && !concreteState.relevant) {
        return false;
      }
      // Also check generic key (for conditions stored under genericized ref)
      const genericKey = refToString(genericize(current));
      if (genericKey !== concreteKey) {
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
  /**
   * Evaluate an XPath expression and return the set of InstanceNodes in the result nodeset.
   * Used for position-aware condition evaluation (multi-instance targets).
   */
  private evaluateAsNodeSet(expr: string): Set<InstanceNode> {
    const ctx = this.makeContext(null);
    const result = evaluateInstanceExpr(expr, ctx.contextNode, XPATH_EVALUATION_RESULT.ANY_TYPE);
    const nodes = new Set<InstanceNode>();
    let node = result.iterateNext();
    while (node !== null) {
      if (node.kind === 'element') {
        nodes.add(node.node);
      }
      node = result.iterateNext();
    }
    return nodes;
  }

  evaluateOnInstance(
    expr: string,
    contextNode?: InstanceNode | null,
  ): string | number | boolean {
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

    let result: ReturnType<typeof compiled.evaluate>;
    try {
      result = compiled.evaluate(ctx);
    } finally {
      setActiveRelevanceCheck(null);
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
    if (!cascadeRoots || cascadeRoots.size === 0) return;

    const toTrigger = getAllToTrigger(cascadeRoots, useDag.immediateCascades);

    const alreadyEvaluated = new Set<Triggerable>();
    for (const triggerable of useDag.triggerablesDAG) {
      if (!toTrigger.has(triggerable)) continue;
      if (alreadyEvaluated.has(triggerable)) continue;

      if (triggerable.kind === 'recalculate') {
        this.applyRecalculate(triggerable, changedRef);
      } else if (triggerable.kind === 'condition') {
        this.applyCondition(triggerable, changedRef);
      }

      alreadyEvaluated.add(triggerable);
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
  private applyRecalculate(t: Triggerable & { kind: 'recalculate' }, changedRef: TreeReference | null): void {
    for (const target of t.targets) {
      // Use resolveAll to handle repeated paths (multiple instances at same generic path)
      const targetNodes = resolveAll(this.tree, target);
      if (targetNodes.length === 0) {
        // Fallback: resolve single (for non-repeated paths)
        const single = resolveReference(this.tree, target);
        if (single !== null) targetNodes.push(single);
      }

      for (const targetNode of targetNodes) {
        const rawResult = this.evaluateCompiled(t.expr, targetNode);

        const rawString = typeof rawResult === 'string'
          ? rawResult
          : typeof rawResult === 'number'
            ? String(rawResult)
            : rawResult
              ? '1'
              : '0';

        const coerced = cast(targetNode.dataType, rawString);
        targetNode.value = coerced;
      }
    }
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
  private applyCondition(t: Triggerable & { kind: 'condition' }, changedRef: TreeReference | null): void {
    for (const target of t.targets) {
      // Use resolveAll to handle repeated paths
      const targetNodes = resolveAll(this.tree, target);
      if (targetNodes.length === 0) {
        const single = resolveReference(this.tree, target);
        if (single !== null) targetNodes.push(single);
      }

      // Determine generic key for this target (used for backward-compat lookup)
      const genericKey = refToString(genericize(target));
      const hasMultipleInstances = targetNodes.length > 1;

      // For multi-instance targets: evaluate with nodeset predicate to get correct
      // position() context. Evaluate (targetPath)[expr] from root and compare nodes.
      // This handles position()-dependent conditions (e.g. relevant="position() > 2").
      let relevantSet: Set<InstanceNode> | null = null;
      if (hasMultipleInstances && t.action === 'relevant') {
        // Build predicate expression: genericPath[expr] to get position-aware nodeset
        // E.g. /data/node[position() > 2]  — XPath 1.0 path predicate, correct position context
        const genericPath = refToString(genericize(target));
        const predicateExpr = `${genericPath}[${t.expr.source}]`;
        relevantSet = this.evaluateAsNodeSet(predicateExpr);
      }

      for (const targetNode of targetNodes) {
        let boolResult: boolean;
        if (relevantSet !== null) {
          // Multi-instance with position: use the nodeset result
          boolResult = relevantSet.has(targetNode);
        } else {
          const rawResult = this.evaluateCompiled(t.expr, targetNode);
          boolResult = toBoolean(rawResult);
        }

        // Store state under BOTH the concrete key (for per-instance lookup) AND
        // the generic key (for backward-compat single-instance lookup in isEffectivelyRelevant).
        const concreteRef = this.nodeToRef(wrapInstanceNode(targetNode, this.docNode));
        const concreteKey = concreteRef !== null ? refToString(concreteRef) : genericKey;

        // Primary state: always update the concrete key
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

    // Re-run initializeInstance logic for all triggerables — their target
    // resolution via resolveAll will now include the new instance.
    for (const triggerable of this.dag.triggerablesDAG) {
      if (triggerable.kind === 'recalculate') {
        this.applyRecalculate(triggerable, repeatRootRef);
      } else if (triggerable.kind === 'condition') {
        this.applyCondition(triggerable, repeatRootRef);
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
