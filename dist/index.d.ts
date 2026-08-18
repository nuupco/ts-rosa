import { Temporal } from 'temporal-polyfill';

/**
 * DataType — the set of XForms primitive data types understood by ts-rosa.
 *
 * Names follow the design (and JavaRosa StandardBindAttributesProcessor),
 * NOT the spec BDD labels:
 *   - 'int' (not 'integer')
 *   - 'unsupported' (not 'uncast')
 */
type DataType = "string" | "int" | "decimal" | "boolean" | "date" | "time" | "dateTime" | "selectOne" | "selectMulti" | "geopoint" | "binary" | "long" | "geoshape" | "geotrace" | "uncast" | "unsupported";
/**
 * Map an XSD type attribute string (or control localName hint) to a DataType.
 *
 * Faithful to JavaRosa StandardBindAttributesProcessor:
 *   xsd:string | ""   -> "string"
 *   xsd:int           -> "int"
 *   xsd:integer       -> "int"
 *   xsd:decimal       -> "decimal"
 *   xsd:boolean       -> "boolean"
 *   xsd:date          -> "date"
 *   xsd:time          -> "time"
 *   xsd:dateTime      -> "dateTime"
 *   select1           -> "selectOne"
 *   select            -> "selectMulti"
 *   odk:rank          -> "selectMulti" (pyxform's rank bind type; reuses the
 *                        selectMulti codec, per ADR Decision 2 in
 *                        sdd/rank-control/design — verified against pyxform
 *                        3.0.1 source: question_type_dictionary.py maps
 *                        "rank" -> {"control": {"tag": "odk:rank"}, "bind": {"type": "odk:rank"}})
 *   geopoint          -> "geopoint"
 *   binary            -> "binary"
 *   null | anything else -> "unsupported" (unless null/"" -> "string")
 */
declare function dataTypeFromXsdName(xsd: string | null): DataType;

/**
 * AnswerValue — discriminated union representing a typed XForms answer.
 *
 * Shape: { kind: DataType; value: <type-specific>; displayText: string }
 * Satisfies the structural contract expected by matchers.ts (value + displayText).
 */
/** Geographic coordinate point */
type GeoPoint = {
    readonly lat: number;
    readonly lon: number;
    readonly alt: number;
    readonly acc: number;
};
/**
 * A single select-choice token.
 * Full SelectChoice (label/index) is a Phase-5 concern.
 */
type SelectChoiceRef = string;
type AnswerValue = {
    readonly kind: "string";
    readonly value: string;
    readonly displayText: string;
} | {
    readonly kind: "int";
    readonly value: number;
    readonly displayText: string;
} | {
    readonly kind: "decimal";
    readonly value: number;
    readonly displayText: string;
} | {
    readonly kind: "boolean";
    readonly value: boolean;
    readonly displayText: string;
} | {
    readonly kind: "date";
    readonly value: Date;
    readonly displayText: string;
} | {
    readonly kind: "time";
    readonly value: Date;
    readonly displayText: string;
} | {
    readonly kind: "dateTime";
    readonly value: Date;
    readonly displayText: string;
} | {
    readonly kind: "selectOne";
    readonly value: SelectChoiceRef;
    readonly displayText: string;
} | {
    readonly kind: "selectMulti";
    readonly value: readonly SelectChoiceRef[];
    readonly displayText: string;
} | {
    readonly kind: "geopoint";
    readonly value: GeoPoint;
    readonly displayText: string;
} | {
    readonly kind: "binary";
    readonly value: string;
    readonly displayText: string;
}
/**
 * long: JavaRosa LongData. JS number is safe up to 2^53 — sufficient for
 * XForms long values in practice. bigint is intentionally avoided for
 * consistency with int/decimal.
 */
 | {
    readonly kind: "long";
    readonly value: number;
    readonly displayText: string;
}
/**
 * geoshape: JavaRosa GeoShapeData — a polygon represented as an ordered list
 * of GeoPoint values. Serialised as points separated by ';', each point as
 * "lat lon alt acc" (JavaRosa GeoShape wire format).
 */
 | {
    readonly kind: "geoshape";
    readonly value: readonly GeoPoint[];
    readonly displayText: string;
}
/**
 * geotrace: JavaRosa GeoTraceData — a polyline/trace represented as an ordered
 * list of GeoPoint values. Same wire format as geoshape.
 */
 | {
    readonly kind: "geotrace";
    readonly value: readonly GeoPoint[];
    readonly displayText: string;
}
/**
 * uncast: raw string without a resolved type — mirrors JavaRosa UncastData.
 * Used as an intermediary before the cast/bind pass. NOT produced from any
 * xsd:type attribute; never stored as a final answer value in normal flow.
 */
 | {
    readonly kind: "uncast";
    readonly value: string;
    readonly displayText: string;
} | {
    readonly kind: "unsupported";
    readonly value: string;
    readonly displayText: string;
};

/**
 * codecs.ts — cast (raw string → AnswerValue) and uncast (AnswerValue → raw string).
 *
 * JR-faithful, ISO 8601 compliant. Round-trip lossless for all modeled types.
 */

declare function cast(type: DataType, raw: string): AnswerValue | null;
declare function uncast(v: AnswerValue): string;
declare function stringValue(s: string): AnswerValue;
declare function intValue(n: number): AnswerValue;
declare function decimalValue(n: number): AnswerValue;
declare function booleanValue(b: boolean): AnswerValue;
declare function dateValue(d: Date): AnswerValue;
declare function selectOneValue(token: string): AnswerValue;
declare function selectMultiValue(tokens: readonly string[]): AnswerValue;

declare const DEFAULT_MULTIPLICITY = 0;
declare const INDEX_UNBOUND = -1;
declare const INDEX_TEMPLATE = -2;
declare const INDEX_ATTRIBUTE = -4;
type Multiplicity = number;

type XPathPredicate = unknown;
type TreeReferenceLevel = {
    readonly name: string;
    readonly multiplicity: Multiplicity;
    readonly predicates: readonly XPathPredicate[];
};
declare function level(name: string, multiplicity?: Multiplicity): TreeReferenceLevel;

type RefContext = 'absolute' | 'inherited' | 'original' | 'instance';
type TreeReference = {
    readonly refLevel: number;
    readonly contextType: RefContext;
    readonly instanceName: string | null;
    readonly levels: readonly TreeReferenceLevel[];
};
declare const REF_ABSOLUTE = -1;
declare function rootRef(): TreeReference;
declare function selfRef(): TreeReference;
declare function extendRef(ref: TreeReference, name: string, mult?: Multiplicity): TreeReference;
declare function parentOf(ref: TreeReference): TreeReference;
declare function genericize(ref: TreeReference): TreeReference;
declare function contextualize(ref: TreeReference, context: TreeReference): TreeReference;
declare function refEquals(a: TreeReference, b: TreeReference): boolean;
declare function refToString(ref: TreeReference): string;
declare function parseAbsoluteRef(path: string): TreeReference;

type InstanceNode = {
    readonly name: string;
    multiplicity: Multiplicity;
    value: AnswerValue | null;
    readonly children: InstanceNode[];
    attributes: Map<string, string> | null;
    dataType: DataType;
    parent: InstanceNode | null;
    preload?: string | null;
    preloadParams?: string | null;
};
declare function getAttribute(node: InstanceNode, name: string): string | undefined;
declare function setAttribute(node: InstanceNode, name: string, value: string): void;
declare function deleteAttribute(node: InstanceNode, name: string): void;
declare function attributeNames(node: InstanceNode): string[];
interface NewNodeOptions {
    multiplicity?: Multiplicity;
    value?: AnswerValue | null;
    dataType?: DataType;
}
declare function newNode(name: string, opts?: NewNodeOptions): InstanceNode;
declare function appendChild(parent: InstanceNode, child: InstanceNode): void;
declare function childrenNamed(node: InstanceNode, name: string): InstanceNode[];
/**
 * Same-name children that are NOT repeat templates — the "candidates" set
 * used throughout TreeReference resolution (resolveReference/resolveAll/
 * resolveAllWithin/resolveAllContextualized). Single pass over
 * `node.children`, rather than `childrenNamed(...).filter(...)`'s two
 * chained scans — halves the per-level scan cost of every reference
 * resolution.
 */
declare function realChildrenNamed(node: InstanceNode, name: string): InstanceNode[];
/**
 * The Nth (0-indexed) same-name non-template child, or null if there aren't
 * that many. Single pass with early exit as soon as the target position is
 * reached — avoids materializing the full candidates array (via
 * `realChildrenNamed`) when only one position is actually needed, which is
 * the common case (a concrete or default-multiplicity reference level).
 */
declare function nthRealChildNamed(node: InstanceNode, name: string, index: number): InstanceNode | null;
/**
 * Deep-clone an InstanceNode subtree.
 * The clone has no parent set (caller must appendChild).
 * Multiplicity is reset to DEFAULT_MULTIPLICITY (appendChild will update it).
 */
declare function cloneNode(source: InstanceNode): InstanceNode;

type InstanceTree = {
    readonly root: InstanceNode;
    readonly name: string | null;
};
/**
 * Resolves an absolute TreeReference to an InstanceNode.
 *
 * Resolution rules (per design §3 / resolveReference flow):
 * - Walk tree.root level-by-level matching level.name.
 * - TEMPLATE nodes are skipped (filtered out before index selection).
 * - INDEX_UNBOUND (-1) → use DEFAULT_MULTIPLICITY (0) = first instance.
 * - Concrete index >= 0 → pick that positional same-name sibling.
 * - Returns null if any level fails to match.
 */
declare function resolveReference(tree: InstanceTree, ref: TreeReference): InstanceNode | null;
/**
 * Returns all matching InstanceNodes for the given reference, starting the
 * BFS from `subtreeRoot` instead of tree.root.
 *
 * `subtreeRoot` must correspond to a prefix of `ref.levels`. The function
 * computes the depth of `subtreeRoot` (by walking its parent chain) and uses
 * the remaining ref levels (the suffix) to expand within the subtree only.
 *
 * This avoids the full-tree BFS of resolveAll() when we only need nodes inside
 * a single concrete repeat instance. Returns the same nodes as resolveAll()
 * would, but restricted to descendants of subtreeRoot.
 *
 * Used by applyRecalculate in initializeRepeatInstance (Fix B: scope resolveAll
 * to subtreeRoot so the global walk is eliminated during repeat-instance init).
 */
declare function resolveAllWithin(tree: InstanceTree, subtreeRoot: InstanceNode, ref: TreeReference): InstanceNode[];
/**
 * Resolve `ref` (which may have wildcard levels) scoped to the deepest concrete
 * ancestor shared with `changedRef`.
 *
 * This mirrors JavaRosa's Triggerable.contextualize: given a changed ref like
 * /data/household[9]/consent and a generic target like /data/household/child_repeat/field,
 * find the longest common concrete prefix (/data/household[9]), then expand only
 * the suffix (child_repeat/field) from that concrete ancestor node.
 *
 * Result is always a strict subset of what resolveAll(tree, ref) returns — only the
 * instances that share the same repeat-instance ancestors as changedRef. This is the
 * key to breaking the O(N²) cost in triggerTriggerables: instead of resolving ALL 108
 * child instances when answering a household-level field, we resolve only the 6 children
 * of the changed household.
 *
 * Falls back to full resolveAll when changedRef and ref share no concrete prefix
 * (e.g. the target is completely unrelated to the changed node's path).
 *
 * @param tree        The instance tree
 * @param ref         Generic target ref (the triggerable's target)
 * @param changedRef  Concrete changed ref (the trigger that fired the cascade)
 */
declare function resolveAllContextualized(tree: InstanceTree, ref: TreeReference, changedRef: TreeReference): InstanceNode[];
/**
 * Returns all matching InstanceNodes for the given reference.
 * When multiplicity is INDEX_UNBOUND, returns ALL same-name children (wildcard expansion).
 */
declare function resolveAll(tree: InstanceTree, ref: TreeReference): InstanceNode[];
/**
 * Add a new repeat instance by cloning the template node (or first instance)
 * at the given path. Updates sibling multiplicities.
 *
 * Returns the newly added InstanceNode, or null if the path doesn't resolve.
 */
declare function addRepeatInstance(tree: InstanceTree, ref: TreeReference): InstanceNode | null;
/**
 * Remove a specific repeat instance (identified by concrete positional ref).
 * Re-indexes remaining instances. Returns removed node or null if not found.
 */
declare function removeRepeatInstance(tree: InstanceTree, ref: TreeReference): InstanceNode | null;
/**
 * Count non-template repeat instances at the given path.
 */
declare function countRepeatInstances(tree: InstanceTree, ref: TreeReference): number;

type ControlType = 'input' | 'select1' | 'select' | 'rank' | 'trigger' | 'upload' | 'range' | 'secret' | 'unknown';
/**
 * Maps an XForms element localName to a ControlType.
 * group/repeat are NOT controls — they are handled as structural containers in FormElement.
 *
 * NOTE: 'rank' shares its answer codec/DataType ('selectMulti') with 'select'
 * (see DataType.ts), but remains a DISTINCT controlType discriminator — do not
 * conflate rank with select_multiple in consumer code. They differ in UI
 * affordance (ordered ranking vs. unordered multi-pick) even though the wire
 * representation (space-separated ordered tokens) and codec are identical.
 */
declare function controlTypeFromTag(localName: string): ControlType;

/**
 * DataBinding — the parsed form of a <bind> element.
 *
 * XPATH FIREWALL: relevant/required/readonly_/calculate/constraint/constraintMsg are stored
 * as RAW STRINGS only. They are NEVER parsed, compiled, or evaluated in Phase 1.
 * Phase 3 will consume these raw strings to produce Triggerables.
 */
type DataBinding = {
    readonly nodeset: string;
    readonly ref: TreeReference;
    readonly dataType: DataType;
    readonly relevant: string | null;
    readonly required: string | null;
    readonly readonly_: string | null;
    readonly calculate: string | null;
    readonly constraint: string | null;
    readonly constraintMsg: string | null;
    readonly preload: string | null;
    readonly preloadParams: string | null;
};

/**
 * A static choice item from a <item> child of select1/select elements.
 * Dynamic itemsets are a Phase 5c concern.
 */
type ChoiceItem = {
    readonly value: string;
    /** Raw text content of the label element (non-itext label). */
    readonly labelText: string | null;
    /**
     * True when the label is driven by jr:itext('id') rather than a literal text node.
     * Added in Slice 5a to support itext-driven static choice labels.
     */
    readonly labelIsItext?: boolean;
    /**
     * The extracted itext id when labelIsItext = true.
     * e.g. for <label ref="jr:itext('fruit:apple')"/> → labelItextId = 'fruit:apple'.
     */
    readonly labelItextId?: string | null;
};
/**
 * ItemsetDef — describes a dynamic <itemset> inside a select/select1 question.
 * Added in Slice 5c. When present, choices are computed on-demand via
 * FormEvaluator.getChoices() rather than stored statically.
 */
interface ItemsetDef {
    /** The nodeset XPath expression, e.g. instance('cities')/root/item[state=/data/state] */
    readonly nodesetExpr: string;
    /** Relative XPath for the value of each node, e.g. "name" */
    readonly valueExpr: string;
    /** Relative XPath for the label of each node, OR jr:itext(...) expression */
    readonly labelExpr: string;
    /** True when labelExpr is a jr:itext(...) reference */
    readonly labelIsItext: boolean;
    /**
     * The literal itext id extracted from a static jr:itext('id') label expression.
     * Null when labelIsItext is false, or when the id is dynamic (an XPath expr).
     * When non-null, used as a static itext key; otherwise labelExpr is evaluated
     * as XPath per node to get the runtime itext id.
     */
    readonly labelItextId: string | null;
}
/**
 * FormElement — discriminated union for the body/control tree.
 *
 * 'repeat' is present structurally; navigation/instantiation is deferred to Phase 4.
 * UI/derived state (relevant, required, readonly, enabled) does NOT live here — deferred to NodeState (Phase 3).
 */
type FormElement = {
    readonly kind: 'question';
    readonly ref: TreeReference;
    readonly controlType: ControlType;
    readonly binding: DataBinding | null;
    readonly labelText: string | null;
    /**
     * Label inner text with <output> elements replaced by ${index} placeholders,
     * preserving surrounding whitespace (including non-breaking spaces).
     * Mirrors JavaRosa QuestionDef.getLabelInnerText().
     * Null when no label is present.
     */
    readonly labelInnerText: string | null;
    /**
     * Raw XPath `value` expression of each `<output>` found in the label,
     * index-aligned with the `${n}` placeholders in labelInnerText.
     * Empty array when the label has no `<output>` children or no label.
     * Added in output-label-substitution PR2 (parse-time output capture).
     */
    readonly labelOutputs?: readonly string[];
    readonly choices: readonly ChoiceItem[];
    readonly itemset: ItemsetDef | null;
    readonly appearance?: string | null;
    readonly mediatype?: string | null;
    readonly hintText?: string | null;
    /**
     * Hint inner text with <output> elements replaced by ${index}
     * placeholders, mirroring labelInnerText. Null when no hint is present.
     * Added in output-label-substitution PR2.
     */
    readonly hintInnerText?: string | null;
    /**
     * Raw XPath `value` expression of each `<output>` found in the hint,
     * index-aligned with the `${n}` placeholders in hintInnerText.
     * Empty array when the hint has no `<output>` children or no hint.
     * Added in output-label-substitution PR2.
     */
    readonly hintOutputs?: readonly string[];
    /**
     * The extracted itext id when the question's <label> is driven by
     * jr:itext('id') rather than literal text, e.g.
     * <label ref="jr:itext('q1:label')"/> → labelItextId = 'q1:label'.
     * Null/undefined when the label is not itext-driven or absent.
     * Added in output-label-substitution PR1 (question label/hint itext wiring).
     */
    readonly labelItextId?: string | null;
    /**
     * The extracted itext id when the question's <hint> is driven by
     * jr:itext('id'), mirroring labelItextId.
     * Added in output-label-substitution PR1.
     */
    readonly hintItextId?: string | null;
    readonly rangeStart?: number;
    readonly rangeEnd?: number;
    readonly rangeStep?: number;
} | {
    readonly kind: 'group';
    readonly ref: TreeReference;
    readonly children: readonly FormElement[];
    readonly labelText: string | null;
    readonly appearance?: string | null;
    readonly hintText?: string | null;
} | {
    readonly kind: 'repeat';
    readonly ref: TreeReference;
    readonly children: readonly FormElement[];
    readonly labelText: string | null;
    readonly countExpr: string | null;
    readonly hintText?: string | null;
};

declare const XPathNodeKindKey: unique symbol;
type XPathNodeKindKey = typeof XPathNodeKindKey;

/**
 * Temporal — native-first seam over `temporal-polyfill`.
 *
 * Environments that already ship the `Temporal` global (newer JS engines)
 * skip loading/executing the polyfill's implementation entirely; engines
 * without it (e.g. Hermes/React Native today) fall back transparently.
 */

declare global {
    var Temporal: typeof Temporal | undefined;
}

/**
 * Itext types — ts-rosa-native itext / localizer model.
 *
 * Mirrors JavaRosa Localizer semantics without adapting the vendored
 * XFormsItextTranslations class (which is bound to XFormsXPathEvaluator and
 * creates circular imports).
 *
 * Slice 5a wires up `makeItextResolver`; the PREREQ slice only needs
 * `ItextResolver` as a type so `InstanceDocumentNode` can carry it.
 */
type ItextLanguage = string;
type ItextId = string;
/** form attribute on <value form="..."> (e.g. 'long','short','image','guidance'). */
type ItextForm = string;
interface ItextValue {
    readonly form: ItextForm | null;
    readonly text: string;
    /**
     * Raw XPath `value` expression of each `<output>` found in this value's
     * source `<value>`/`<text>` element, index-aligned with the `${n}`
     * placeholders in `text`. Empty array when there are no outputs.
     * Added in output-label-substitution PR2 (parse-time output capture).
     */
    readonly outputs: readonly string[];
}
/** Per-language map: itext id → its <value> entries (one per form). */
type ItextTranslation = ReadonlyMap<ItextId, readonly ItextValue[]>;
interface ItextTranslations {
    readonly languages: readonly ItextLanguage[];
    readonly explicitDefaultLanguage: ItextLanguage | null;
    /** language → (id → values) */
    readonly byLanguage: ReadonlyMap<ItextLanguage, ItextTranslation>;
}
/**
 * Runtime resolver with mutable active language. Mirrors JavaRosa Localizer.
 *
 * Implemented in Slice 5a by makeItextResolver(); the type lives here so the
 * PREREQ slice and InstanceDocumentNode can reference it without depending on
 * the full implementation.
 */
interface ItextResolver {
    getLanguages(): readonly ItextLanguage[];
    getActiveLanguage(): ItextLanguage | null;
    /** null → reset to explicitDefaultLanguage ?? languages[0]. Returns the effective active language. */
    setActiveLanguage(lang: ItextLanguage | null): ItextLanguage | null;
    /** Resolve active-language value for id + optional form; returns null when id absent in all languages. */
    resolve(id: ItextId, form?: ItextForm): string | null;
    /**
     * Resolve active-language {text, outputs} pair for id + optional form.
     * Same fallback semantics as resolve(); returns null when id absent in all
     * languages. Added in output-label-substitution PR2.
     */
    resolveWithOutputs(id: ItextId, form?: ItextForm): {
        text: string;
        outputs: readonly string[];
    } | null;
}

/**
 * InstanceXPathNode — branded union types satisfying XPathNode constraints.
 *
 * These are thin wrappers over InstanceNode that provide the XPath 1.0 data
 * model (document, element, attribute, text) without modifying InstanceNode
 * itself (which stays pure, data-only, RN-friendly).
 *
 * Branding: each variant carries [XPathNodeKindKey] matching the string literal
 * that XmldomNode uses, so the union satisfies XPathNode at the type level.
 *
 * Identity stability: InstanceElementNode wrappers are cached in a WeakMap so
 * the same InstanceNode always produces the same wrapper object (===). This is
 * required for compareDocumentOrder and nodeset dedup inside the vendored
 * Evaluator. Attribute/text wrappers are transient (never compared ===
 * cross-call by the evaluator).
 */

/**
 * There is exactly ONE document node per evaluation. Its single child element
 * is the wrapper for tree.root. `node` is null because the document node has
 * no backing InstanceNode.
 *
 * Optional per-form fields (populated by FormEvaluator via
 * makeInstanceDocumentNode opts):
 * - secondaryInstances: named secondary instance roots for instance() fn.
 * - itext: active-language resolver for jr:itext() fn.
 */
interface InstanceDocumentNode {
    readonly [XPathNodeKindKey]: 'document';
    readonly kind: 'document';
    readonly tree: InstanceTree;
    readonly node: null;
    /** Named secondary instance roots, keyed by id. Read by native instance() fn. */
    readonly secondaryInstances?: ReadonlyMap<string, InstanceXPathNode>;
    /** Active-language itext resolver. Read by native itext() fn. */
    readonly itext?: ItextResolver | null;
}
interface InstanceElementNode {
    readonly [XPathNodeKindKey]: 'element';
    readonly kind: 'element';
    readonly node: InstanceNode;
    readonly doc: InstanceDocumentNode;
    /**
     * Implements XPathChoiceNode (src/xpath/vendor/xpath/adapter/interface/
     * XPathChoiceNode.ts) for jr:choice-name(). Delegates to the active
     * choice-name resolver (set by FormEvaluator); returns null when unset —
     * e.g. pure XPath unit tests with no FormEvaluator/body tree involved.
     */
    readonly getChoiceName: (value: string) => string | null;
}
interface InstanceAttributeNode {
    readonly [XPathNodeKindKey]: 'attribute';
    readonly kind: 'attribute';
    readonly owner: InstanceElementNode;
    readonly name: string;
    readonly value: string;
}
interface InstanceTextNode {
    readonly [XPathNodeKindKey]: 'text';
    readonly kind: 'text';
    readonly owner: InstanceElementNode;
    readonly value: string;
}
type InstanceXPathNode = InstanceDocumentNode | InstanceElementNode | InstanceAttributeNode | InstanceTextNode;

/**
 * Public value type for XPath `$name` variable bindings (design Decision 5).
 *
 * Primitives only for v1 — node-set-valued variables are explicitly out of
 * scope (would require wrapping foreign nodes into InstanceXPathNode /
 * XmldomNode, which is deferred to a future change alongside setvalue).
 */
type XPathVariableValue = string | number | boolean;

/**
 * InstanceEvaluator — wires PureJSExpressionParser + InstanceNodeXPathAdapter
 * into a vendored Evaluator<InstanceXPathNode>.
 *
 * Reuses the SAME sharedParser and defaultFunctions as XmldomEvaluator.
 * The two evaluators coexist: XmldomEvaluator handles xmldom tests (unchanged);
 * InstanceEvaluator handles FormEvaluator / reactive engine evaluations.
 *
 * This is the coexistence proof for Option A (design §1.1 de-risk gate).
 */

/**
 * Evaluation context for InstanceEvaluator evaluations.
 *
 * - instanceRoot: the synthetic document node for the InstanceTree
 * - contextNode: the current context node for the evaluation
 * - secondaryInstances: optional secondary instance roots (Phase 5)
 * - variables: optional variable bindings ($var, Phase 3.7)
 * - relevanceOf: optional closure — returns true if the node is effectively
 *   relevant. Default = always true (used by pure XPath unit tests).
 *   FormEvaluator injects this in Phase 3.5 to make non-relevant nodes
 *   return '' for XPath reads.
 */
interface InstanceEvaluationContext {
    readonly instanceRoot: InstanceXPathNode;
    readonly contextNode: InstanceXPathNode;
    readonly secondaryInstances?: ReadonlyMap<string, InstanceXPathNode>;
    readonly variables?: ReadonlyMap<string, XPathVariableValue>;
    readonly relevanceOf?: (node: InstanceXPathNode) => boolean;
}

/**
 * XPathSeam — the sole XPath entry point for ts-rosa.
 *
 * Wraps XmldomEvaluator and exposes a minimal API that:
 *   - Accepts an optional EvaluationContext (instance + contextNode)
 *   - Returns a primitive value (number | string | boolean) for scalar results,
 *     or an array of XmldomNode for nodesets — matching the JavaRosa equivalence
 *     test assertions which call evaluateXPath(expr) with no context.
 *   - When no context is provided, uses a minimal stub document so the vendored
 *     Evaluator always has a valid DOM context node.
 *   - compileXPath(expr) parses once and returns a CompiledExpression handle for
 *     Phase 3 DataBinding consumption (parse-once, evaluate-many-times pattern).
 *
 * XPathValue (discriminated union) is exported for callers that need type
 * information beyond the primitive coercion.
 */

/**
 * Result types for InstanceEvaluator evaluation.
 */
type InstanceXPathValue = {
    readonly type: 'BOOLEAN';
    readonly value: boolean;
} | {
    readonly type: 'NUMBER';
    readonly value: number;
} | {
    readonly type: 'STRING';
    readonly value: string;
} | {
    readonly type: 'NODESET';
    readonly nodes: readonly InstanceXPathNode[];
};
/**
 * A CompiledExpression variant that evaluates over an InstanceTree via the
 * InstanceEvaluator (Option A bridge).
 *
 * The xmldom CompiledExpression and this type are intentionally distinct to
 * prevent accidental cross-evaluator usage.
 */
interface CompiledInstanceExpression {
    /** The original expression string, for debugging and caching. */
    readonly source: string;
    /**
     * Evaluate over an InstanceTree context.
     * When context is omitted the expression is evaluated with no context
     * (useful for constant expressions).
     */
    evaluateTyped(context?: InstanceEvaluationContext): InstanceXPathValue;
    evaluate(context?: InstanceEvaluationContext): number | string | boolean | readonly InstanceXPathNode[];
}
/**
 * Parse an XPath expression once and return a reusable CompiledInstanceExpression
 * that evaluates over InstanceTree via the InstanceEvaluator.
 *
 * The xmldom compileXPath() and evaluateXPath() surfaces are UNCHANGED — this
 * is an additive entry point only. The XPathSeam remains the sole XPath import
 * boundary.
 */
declare function compileInstanceXPath(expr: string): CompiledInstanceExpression;

/**
 * Triggerable — Slice 3.2-T3
 *
 * Discriminated union for reactive binding nodes (Recalculate and Condition).
 * Mirrors JavaRosa Triggerable.java / Condition.java / Recalculate.java.
 *
 * These are the vertices of the TriggerableDag built in Slice 3.3.
 */

type ConditionKind = 'relevant' | 'required' | 'readonly';
interface TriggerableBase {
    /**
     * The compiled XPath expression (parse-once, evaluate-many via compileInstanceXPath).
     */
    readonly expr: CompiledInstanceExpression;
    /**
     * Non-contextualized target TreeReferences — the nodes whose state this
     * Triggerable updates when it fires.
     */
    readonly targets: readonly TreeReference[];
    /**
     * Dependencies extracted by getTriggers (genericized, predicate-less absolute refs).
     * Keys into triggerablesPerTrigger.
     */
    readonly triggers: readonly TreeReference[];
    /**
     * Mutable context ref — reduced via intersection in addTriggerable dedup
     * (see TriggerableDag.addTriggerable). This is the only mutable field.
     */
    contextRef: TreeReference;
    /**
     * The original (first-seen) context ref. Immutable. Used by getTriggers for
     * current() / . contextualization and preserved across intersections.
     */
    readonly originalContextRef: TreeReference;
}
interface Recalculate extends TriggerableBase {
    readonly kind: 'recalculate';
}
interface Condition extends TriggerableBase {
    readonly kind: 'condition';
    readonly action: ConditionKind;
}
type Triggerable = Recalculate | Condition;

/**
 * TriggerableDag — Slice 3.3
 *
 * Builds a topologically sorted DAG of Triggerable vertices from the
 * compiled bindings produced by compileBindings.
 *
 * Mirrors JavaRosa TriggerableDag.java:
 *   - finalizeTriggerables → finalizeDag
 *   - getDagEdges         (LinkedHashSet insertion-order iteration)
 *   - getDependantTriggerables (ordered dedup via insertion-ordered Set)
 *   - buildDag            (Kahn topological sort)
 *   - buildRelevancePerRepeat
 *   - addTriggerable      (context intersection dedup)
 *   - throwCyclesInDagException → throws Error(/Cycle detected/i)
 *
 * CRITICAL: Edge insertion order must mirror JavaRosa's LinkedHashSet iteration.
 * JavaScript Set is insertion-ordered (ES2015+), matching LinkedHashSet semantics.
 * The port iterates allTriggerables in insertion order, and within each source,
 * collects dependant triggerables in insertion order — identical to JavaRosa.
 */

interface TriggerableDag {
    /**
     * Insertion-ordered set of all unique triggerables (after dedup via
     * context intersection). Mirrors JavaRosa allTriggerables LinkedHashSet.
     */
    readonly allTriggerables: ReadonlySet<Triggerable>;
    /**
     * Topologically sorted array of all triggerables (Kahn output).
     * Triggerables that depend on another appear AFTER their dependency.
     * Iteration order here is the canonical evaluation order.
     */
    readonly triggerablesDAG: readonly Triggerable[];
    /**
     * Index: genericized ref string → set of triggerables that list that ref
     * among their triggers.
     */
    readonly triggerablesPerTrigger: ReadonlyMap<string, Set<Triggerable>>;
    /**
     * Per-triggerable set of directly-downstream triggerables (pre-computed
     * from getDagEdges). Used by getAllToTrigger in the cascade engine.
     */
    readonly immediateCascades: ReadonlyMap<Triggerable, Set<Triggerable>>;
    /**
     * Index of relevance Conditions whose target is a repeat template reference.
     * Key: refToString(genericize(repeatTarget)).
     * Built by buildRelevancePerRepeat; consumed by repeat add/remove (Slice 3.7).
     */
    readonly relevancePerRepeat: ReadonlyMap<string, Triggerable>;
    /**
     * Each triggerable's position in `triggerablesDAG` (its topological order).
     * Lets triggerTriggerables() sort just the (usually small) toTrigger subset
     * into evaluation order in O(k log k), instead of scanning the full
     * triggerablesDAG array (O(n)) on every answerQuestion() call to filter it
     * down via Set membership.
     */
    readonly triggerableIndex: ReadonlyMap<Triggerable, number>;
}

/**
 * bindProcessor — canonical bind processor (Phase 1 + Phase 3 consolidated).
 *
 * Phase 1 (extract DataBinding records):
 *   - Reads nodeset/ref, type, and copies XPath expression attributes as raw
 *     strings. No parsing, no evaluation.
 *
 * Phase 3 (compile expressions):
 *   - Compiles each DataBinding expression to a CompiledInstanceExpression via
 *     compileInstanceXPath and extracts trigger TreeReferences via getTriggers.
 *   - Produces CompiledBinding records consumed by TriggerableDag (Slice 3.3).
 */

/**
 * A compiled binding entry — one per non-null XPath expression on a <bind>.
 *
 * This is the intermediate representation between bindProcessor and the
 * TriggerableDag build in Slice 3.3. It bundles the compiled expression,
 * extracted triggers, and context refs together.
 *
 * Note: 'constraint' is kept separate from ConditionKind to avoid pulling
 * it into the cascade logic (constraints are validation-only, not cascade sources).
 */
type CompiledBinding = {
    readonly kind: 'recalculate';
    readonly action?: undefined;
    readonly expr: ReturnType<typeof compileInstanceXPath>;
    readonly triggers: readonly TreeReference[];
    readonly contextRef: TreeReference;
    readonly originalContextRef: TreeReference;
    readonly targets: readonly TreeReference[];
} | {
    readonly kind: 'condition';
    readonly action: ConditionKind | 'constraint';
    readonly expr: ReturnType<typeof compileInstanceXPath>;
    readonly triggers: readonly TreeReference[];
    readonly contextRef: TreeReference;
    readonly originalContextRef: TreeReference;
    readonly targets: readonly TreeReference[];
};

/**
 * SetValueAction — event-triggered `<setvalue>` action descriptor.
 *
 * Mirrors JavaRosa's `SetValueAction` / `Action` model: an imperative,
 * event-scoped write, distinct from `Triggerable` (a standing declarative
 * rule re-evaluated on every dependency change). See design doc
 * "sdd/setvalue-actions/design" for the full architecture rationale.
 *
 * v1 supports exactly two events:
 *   - 'odk-instance-first-load' (alias 'xforms-ready'): fires once at
 *     form-load time.
 *   - 'xforms-value-changed': fires when one of `triggers` changes.
 *
 * This module only defines the data shape + a pure event-normalization
 * helper. Parsing (src/parse/actionParser.ts) and firing (FormEvaluator,
 * a later PR) are separate concerns.
 */

/** v1-supported, normalized setvalue events. */
type SetValueEvent = 'odk-instance-first-load' | 'xforms-value-changed';
/**
 * A single parsed `<setvalue>` action declaration.
 *
 * One of `expr` / `literal` is set (never both, never neither):
 *   - `expr` is set when the element has a `value="..."` attribute (compiled
 *     XPath expression).
 *   - `literal` is set when the element uses inner-text instead of a `value`
 *     attribute (a raw string written verbatim, cast at write time).
 */
interface SetValueAction {
    /** Normalized event this action fires on. */
    readonly event: SetValueEvent;
    /** Absolute target TreeReference (`ref` attribute) this action writes to. */
    readonly target: TreeReference;
    /** Compiled value expression, or null when `literal` is used instead. */
    readonly expr: CompiledInstanceExpression | null;
    /** Inner-text literal value, or null when `expr` is used instead. */
    readonly literal: string | null;
    /**
     * Genericized, predicate-less dependency refs that fire this action.
     * Empty for load-time actions; non-empty for `xforms-value-changed` actions
     * (union of the value expression's `getTriggers` deps and, for body-nested
     * actions, the host control's ref).
     */
    readonly triggers: readonly TreeReference[];
    /** Context ref used to contextualize the value expression (= target). */
    readonly contextRef: TreeReference;
    /** Original/first context ref (= target); used by getTriggers for current()/. */
    readonly originalContextRef: TreeReference;
    /** Human-readable source location for fail-loud error messages. */
    readonly sourceLocation: string;
}

/**
 * FormDefinition — pure definition record for a parsed XForms form.
 *
 * Contains only definition + initialized instance template.
 * No session state, no evaluator state (FormSession/FormEvaluator are future phases).
 */
type FormDefinition = {
    readonly title: string | null;
    readonly mainInstance: InstanceTree;
    readonly bindings: ReadonlyMap<string, DataBinding>;
    readonly body: readonly FormElement[];
    /** Topologically sorted reactive DAG (built from compiled bindings in Slice 3.3). */
    readonly dag: TriggerableDag | null;
    /**
     * Compiled constraint expressions per nodeset (key = nodeset string).
     * Constraints are NOT in the cascade DAG — they are evaluated on-demand
     * during answerQuestion and validate().
     */
    readonly constraintBindings: ReadonlyMap<string, CompiledBinding>;
    /**
     * Parsed itext translations from the <itext> block inside <model>.
     * Null when the form has no <itext> element (no i18n).
     */
    readonly itext: ItextTranslations | null;
    /**
     * Named secondary instances parsed from <instance id="..."> children of <model>.
     * Empty map when the form has no secondary instances.
     */
    readonly secondaryInstances: ReadonlyMap<string, InstanceTree>;
    /**
     * External secondary instance declarations parsed from
     * `<instance id="..." src="jr://...">` children of `<model>`.
     *
     * Unresolved markers only — `resolveExternalInstances` (async) fetches
     * and parses their content, merging the result into `secondaryInstances`.
     * Empty map when the form declares no external instances.
     */
    readonly externalInstances: ReadonlyMap<string, {
        readonly src: string;
    }>;
    /**
     * Parsed `<setvalue>` action declarations (event-triggered writes), from
     * both model-level action children and body-nested elements. Empty array
     * when the form declares no setvalue actions.
     *
     * Stored here as pure data — NOT wired into the DAG. Consumed by a
     * separate ActionRegistry at session-creation time (see FormSession.ts).
     */
    readonly actions: readonly SetValueAction[];
};
/**
 * Depth-first traversal of the form body, calling visitor for each question element.
 * Groups and repeats are traversed but not passed to the visitor.
 */
declare function walkControls(def: FormDefinition, visitor: (q: FormElement & {
    kind: 'question';
}) => void): void;

/**
 * XFormParser — 4-step pure pipeline for XForms parsing.
 *
 * Step 1: Walk <instance> DOM → build InstanceTree
 * Step 2: Parse <bind> elements → build DataBinding map (XPATH FIREWALL)
 * Step 3: Parse <body> children → build FormElement tree
 * Step 4: applyBindings (second pure pass) → set dataType + cast values on InstanceNodes
 */

/**
 * parseDocument — seam-free. Accepts a pre-parsed W3C Document.
 * All 4 pipeline steps run here.
 */
declare function parseDocument(doc: Document): FormDefinition;
/**
 * parseForm — entry point that uses the registered XmlParser seam.
 */
declare function parseForm(xml: string): FormDefinition;

/**
 * Result of answering a question in a form session.
 *
 * Member names mirror JavaRosa's FormEntryController answer constants exactly,
 * enabling zero-rename porting of JavaRosa test code.
 *
 * Lives in src/ (not tests/) on purpose: this is a real public domain type of
 * the engine, not a test-only helper. Do not move it into the harness during
 * cleanups — the Scenario stubs and the future engine both depend on it.
 */
declare enum AnswerResult {
    OK = "OK",
    REQUIRED_BUT_EMPTY = "REQUIRED_BUT_EMPTY",
    CONSTRAINT_VIOLATED = "CONSTRAINT_VIOLATED"
}

/**
 * NodeState — derived UI/reactive state for a bound node.
 *
 * Slice 3.5: NodeState is owned by FormEvaluator in a Map keyed by
 * refToString(genericize(ref)). It is NEVER stored on InstanceNode
 * (keeps data tree pure).
 *
 * Fields:
 *   relevant  — own relevance (result of the node's relevant Condition)
 *   enabled   — inverse of readonly / itemset enable (Phase 3.5: driven by readonly Condition)
 *   required  — driven by required Condition
 *   readonly  — driven by readonly Condition
 *   constraintMsg — last constraint message (Phase 3.6)
 *   calculatedValue — last computed value (informational; actual value lives on InstanceNode)
 *
 * Effective relevance (own AND all ancestors relevant) is computed by
 * ancestor walk in FormEvaluator.isEffectivelyRelevant — NOT stored here.
 */

interface NodeState {
    relevant: boolean;
    enabled: boolean;
    required: boolean;
    readonly: boolean;
    constraintMsg: string | null;
    calculatedValue: AnswerValue | null;
}

/**
 * OpaqueReactiveObjectFactory — Slice 3.5
 *
 * An opaque factory that wraps a plain object into a (potentially reactive)
 * proxy. The default identity factory returns the object unchanged.
 *
 * Framework adapters (Solid, Vue, Zustand, Jotai, …) inject a factory that
 * returns a reactive proxy. Because FormEvaluator MUTATES the returned object
 * in place (state.relevant = x), reactive proxies observe writes transparently.
 *
 * STRUCTURAL-IDENTITY CONTRACT: the factory MUST return an object with the
 * same shape as the input — never a clone with a different field set.
 *
 * Core code never imports any reactive runtime. This seam is the only point
 * of contact between the pure engine and any framework reactivity layer.
 */
interface OpaqueReactiveObjectFactory {
    <T extends object>(initial: T): T;
}

/**
 * ActionRegistry — JavaRosa ActionController analog.
 *
 * Organizes a FormDefinition's parsed `SetValueAction[]` (src/eval/SetValueAction.ts)
 * by event type so FormEvaluator/FormSession can fire them without re-scanning
 * `definition.actions` on every lookup. Deliberately separate from
 * TriggerableDag (see design doc "sdd/setvalue-actions/design", ADR-1):
 * actions are imperative/event-scoped, not standing declarative rules.
 *
 * v1 (this module, PR2 scope) only organizes:
 *   - `loadActions`: actions with event === 'odk-instance-first-load', in
 *     declaration order (fire once, at session-creation time).
 *   - `valueChangedByTrigger`: actions with event === 'xforms-value-changed',
 *     keyed by the SAME `refToString(genericize(ref))` convention
 *     TriggerableDag.triggerablesPerTrigger uses, so a future PR's
 *     triggerTriggerables hook can look them up symmetrically. Wiring the
 *     firing of these into triggerTriggerables is PR3 scope — this module
 *     only builds the map.
 */

interface ActionRegistry {
    /** Load-time (odk-instance-first-load) actions, in declaration order. */
    readonly loadActions: readonly SetValueAction[];
    /**
     * Value-changed actions keyed by `refToString(genericize(triggerRef))`.
     * An action appears once per distinct trigger ref (a single action can have
     * multiple triggers, per SetValueAction.triggers).
     */
    readonly valueChangedByTrigger: ReadonlyMap<string, readonly SetValueAction[]>;
}

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

/**
 * Result of a full-form validation sweep.
 * Mirrors JavaRosa ValidateOutcome — null means the form is valid.
 */
interface ValidateOutcome {
    /** The absolute path (nodeset) of the first field that failed validation. */
    readonly failedNodeset: string;
    /** The reason for failure. */
    readonly status: AnswerResult.REQUIRED_BUT_EMPTY | AnswerResult.CONSTRAINT_VIOLATED;
}
/** A resolved dynamic choice item returned by getChoices(). */
interface SelectChoice {
    /** The value string (from <value ref="..."/> evaluation). */
    readonly value: string;
    /** The label string (from <label ref="..."/> or itext resolution). Null if unresolvable. */
    readonly label: string | null;
}
/** Options bag for FormEvaluator constructor (all optional for backward compat). */
interface FormEvaluatorOptions {
    readonly factory?: OpaqueReactiveObjectFactory;
    readonly itext?: ItextTranslations | null;
    readonly secondaryInstances?: ReadonlyMap<string, InstanceTree>;
    /** Body element tree — needed by getChoices() to find ItemsetDef by ref. */
    readonly body?: readonly FormElement[];
}
declare class FormEvaluator {
    private readonly tree;
    private docNode;
    /** Reactive DAG — set by initializeInstance; null until a form with bindings is loaded. */
    private dag;
    /**
     * setvalue ActionRegistry — set by setActionRegistry (session-creation
     * time, src/session/FormSession.ts). Null when the form declares no
     * setvalue actions (buildActionRegistry always returns a non-null
     * registry, but a session that never calls setActionRegistry — e.g. tests
     * constructing FormEvaluator directly — has no actions to fire).
     * sdd/setvalue-actions PR2.
     */
    private actionRegistry;
    /** NodeState per bound node — keyed by refToString(genericize(ref)). */
    private readonly nodeStates;
    /** Factory for creating reactive node state objects (default: identity). */
    private readonly factory;
    /**
     * Compiled constraint expressions, keyed by nodeset string (e.g. "/data/a").
     * Set by initializeInstance from the FormDefinition.constraintBindings.
     */
    private constraintBindings;
    /** Itext resolver for the active session. Null when form has no itext. */
    private readonly itextResolver;
    /** Wrapped secondary instance roots, keyed by id. Read by native instance() fn via docNode. */
    private readonly secondaryDocs;
    /** Body element tree — used to find ItemsetDef by ref in getChoices(). */
    private readonly body;
    /**
     * Cache for dynamic choice results, keyed by question ref string.
     * Each entry stores the trigger-signature computed when choices were last
     * evaluated; a changed signature triggers recomputation.
     */
    private readonly choiceCache;
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
    private readonly itemsetIndexCache;
    constructor(tree: InstanceTree, opts?: OpaqueReactiveObjectFactory | FormEvaluatorOptions);
    /**
     * Switch the active language for itext resolution.
     * Throws when `lang` is not in the form's translation list (REQ-5A-4).
     * Passing null resets to the default language.
     * No-op when the form has no itext block.
     */
    setLanguage(lang: string | null): string | null;
    /**
     * Return the list of available languages (in declaration order).
     * Returns empty array when form has no itext.
     */
    getLanguages(): readonly string[];
    /**
     * Return the currently active language.
     * Returns null when form has no itext.
     */
    getActiveLanguage(): string | null;
    /**
     * Resolve an itext id to its string value in the active language.
     * Returns null when the id is absent in all languages.
     * Returns null when form has no itext.
     */
    resolveItext(id: string): string | null;
    /**
     * Resolve an itext id to its {text, outputs} pair in the active language.
     * Returns null when the id is absent in all languages, or when the form
     * has no itext. Added in output-label-substitution PR3.
     */
    resolveItextWithOutputs(id: string): {
        text: string;
        outputs: readonly string[];
    } | null;
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
    private substituteOutputs;
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
    substituteText(template: string | null, outputs: readonly string[], contextRef: TreeReference): string | null;
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
    getChoices(ref: TreeReference): readonly SelectChoice[];
    private static readonly EQUALITY_FILTER_SHAPE_RE;
    private static isBareName;
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
    private tryEqualityFilterFastPath;
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
    invalidateChoiceCache(): void;
    /**
     * Resolve a choice label for one itemset result node.
     *
     * This is the single coordination point between 5a (itext) and 5c (itemset).
     * - labelIsItext = false → evaluate labelExpr as XPath string against the node.
     * - labelIsItext = true, labelItextId non-null → static itext id, resolve directly.
     * - labelIsItext = true, labelItextId null → evaluate labelExpr as XPath to get
     *   the runtime itext id, then resolve that id.
     */
    private resolveChoiceLabel;
    /**
     * Evaluate a relative XPath expression against an InstanceXPathNode.
     * Returns the string result (or empty string on error/empty nodeset).
     */
    private evaluateRelativeOnNode;
    /**
     * Run `fn` with the active jr:choice-name() resolver set to this
     * FormEvaluator's own resolveChoiceName, restoring whatever was active
     * before on exit (safe for nested/re-entrant calls, and for multiple
     * FormEvaluator instances alive at once — see setActiveChoiceNameResolver).
     */
    private withActiveChoiceNameResolver;
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
    private resolveChoiceName;
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
    private computeTriggerSig;
    /**
     * Find the question FormElement for the given ref by walking the body tree.
     * Returns null if not found or if the body is empty.
     */
    private findQuestionByRef;
    /**
     * Get or create NodeState for a genericized ref key.
     */
    private getOrCreateState;
    /**
     * Return the effective relevance of a ref: own relevant AND all ancestors relevant.
     *
     * Mirrors JavaRosa TriggerableDag isEffectivelyRelevant — walks the ref's
     * parent chain consulting own NodeState.relevant for each ancestor.
     */
    isEffectivelyRelevant(ref: TreeReference): boolean;
    /**
     * Get the NodeState for a ref (by genericized key). Returns undefined if not found.
     */
    getNodeState(ref: TreeReference): NodeState | undefined;
    /**
     * Build an InstanceEvaluationContext for a given context InstanceNode.
     * When contextNode is null/undefined the document root is used.
     */
    private makeContext;
    /**
     * Evaluate an XPath expression string over the InstanceTree.
     *
     * Returns a primitive (string | number | boolean) or the first node's
     * string-value when the result is a nodeset.
     */
    evaluateOnInstance(expr: string, contextNode?: InstanceNode | null): string | number | boolean;
    /**
     * Evaluate a pre-compiled instance expression with the active relevance closure.
     * Used by the DAG-based cascade.
     */
    evaluateCompiled(compiled: CompiledInstanceExpression, contextNode?: InstanceNode | null): string | number | boolean;
    /**
     * Derive a concrete TreeReference from an InstanceXPathNode by walking its parent chain.
     *
     * Per design §8: accumulates (name, positional multiplicity among same-name non-template siblings).
     * The resulting ref has concrete multiplicities (0-indexed position) at each level,
     * allowing per-instance NodeState keys and indexed-repeat unwrapping.
     *
     * Returns null if the node cannot be mapped (e.g. document node).
     */
    private nodeToRef;
    /** Expose the document node for callers that need to build their own contexts. */
    getDocumentNode(): InstanceDocumentNode;
    /** Wrap an InstanceNode into an InstanceXPathNode for use in evaluations. */
    wrap(node: InstanceNode): InstanceXPathNode;
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
    isNodeRelevant(node: InstanceNode): boolean;
    /**
     * Initialize all triggerables in topological DAG order.
     *
     * Mirrors JavaRosa TriggerableDag.initializeTriggerables (FormDef.java:447-466).
     * Called once at session creation to bring the instance to steady state.
     *
     * Slice 3.5: also initializes NodeState for all bound nodes, and evaluates
     * all Conditions (relevant/required/readonly) to set initial NodeState.
     */
    initializeInstance(dag: TriggerableDag, constraintBindings?: ReadonlyMap<string, CompiledBinding>): void;
    /**
     * Write a value to the InstanceNode at ref, then trigger the reactive cascade.
     *
     * Mirrors JavaRosa FormDef.setValue + triggerTriggerables.
     * Option A: there is NO parallel DOM — the InstanceTree is the sole data store.
     */
    setValue(ref: TreeReference, value: AnswerValue | null): void;
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
    triggerTriggerables(changedRef: TreeReference, dag?: TriggerableDag | null): void;
    /**
     * Install the setvalue ActionRegistry built from the session's
     * FormDefinition.actions (src/eval/ActionRegistry.ts). Must be called
     * before fireLoadActions(). A no-op call with an empty registry is safe —
     * fireLoadActions() then does nothing.
     *
     * sdd/setvalue-actions PR2, task 9.
     */
    setActionRegistry(registry: ActionRegistry): void;
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
    fireLoadActions(): void;
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
    private actionChainDepth;
    /** sdd/setvalue-actions PR3, design ADR-2: fail-loud bound for chained actions. */
    private static readonly MAX_ACTION_CHAIN_DEPTH;
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
    private fireAction;
    private fireActionInner;
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
    private applyRecalculate;
    private evaluateExprFast;
    private applyRecalculateGrouped;
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
    private evaluateRelevantSetByConcreteParent;
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
    private applyCondition;
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
    answerQuestion(ref: TreeReference, value: AnswerValue | null): AnswerResult;
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
    validate(allNodesets: readonly string[]): ValidateOutcome | null;
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
    initializeRepeatInstance(repeatRootRef: TreeReference): void;
    /**
     * Re-trigger all triggerables that depend on nodes within the given repeat
     * path. Called after a repeat instance is removed to update counts, cascades, etc.
     *
     * @param genericRepeatRef  The genericized ref of the repeat (e.g. /data/repeat)
     */
    triggerRepeatRemoval(genericRepeatRef: TreeReference): void;
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
    private propagateRelevanceToDescendants;
}

/**
 * FormIndex — positional cursor for the form entry engine (Phase 4).
 *
 * @experimental Phase 4 cursor API. NOT exported from any stable barrel.
 *
 * Design: flattened path array (equivalent to JavaRosa's collapsed
 * indexes+multiplicities parallel lists) rather than a mutable linked list.
 * Each step produces a NEW FormIndex; the cursor itself is immutable data.
 *
 * Firewall: ZERO XPath imports. FormIndex/FormNavigator are pure TS values.
 */

/**
 * One nesting level of a positional form cursor.
 *
 * Mirrors JavaRosa FormIndex.localIndex (elementIndex) + instanceIndex (multiplicity).
 *   elementIndex = 0-based index into the parent FormElement[] children array
 *   multiplicity = 0-based repeat-instance index for that element; 0 for non-repeats.
 */
interface FormIndexLevel {
    readonly elementIndex: number;
    readonly multiplicity: number;
}
/** Cursor before the first event. */
interface BeginningOfFormIndex {
    readonly kind: 'bof';
}
/** Cursor past the last event. */
interface EndOfFormIndex {
    readonly kind: 'eof';
}
/**
 * Cursor positioned AT a body element.
 *
 * `path` is the root→leaf chain of levels (path[0] indexes FormDefinition.body).
 * `ref` is the resolved concrete TreeReference (positional multiplicities).
 */
interface AtFormIndex {
    readonly kind: 'at';
    readonly path: readonly FormIndexLevel[];
    readonly ref: TreeReference;
}
/** Discriminated union for the form cursor position. */
type FormIndex = BeginningOfFormIndex | EndOfFormIndex | AtFormIndex;
/** Singleton BOF sentinel (mirrors FormIndex.createBeginningOfFormIndex). */
declare const beginningOfForm: FormIndex;
/** Singleton EOF sentinel (mirrors FormIndex.createEndOfFormIndex). */
declare const endOfForm: FormIndex;
/**
 * Create an AtFormIndex at the given path + resolved ref.
 * The path array is frozen (immutable).
 */
declare function atIndex(path: readonly FormIndexLevel[], ref: TreeReference): AtFormIndex;
/** Returns true when the cursor is at BOF. */
declare function isBof(i: FormIndex): i is BeginningOfFormIndex;
/** Returns true when the cursor is at EOF. */
declare function isEof(i: FormIndex): i is EndOfFormIndex;
/** Returns true when the cursor is positioned AT a body element. */
declare function isAt(i: FormIndex): i is AtFormIndex;

/**
 * FormEntryEvent — inbound cursor-position axis for form entry (Phase 4).
 *
 * @experimental Phase 4 cursor API. NOT exported from any stable barrel.
 *
 * Firewall: COMPLETELY separate from FormEvent (Phase 3, outbound change
 * notifications). These are TWO DISTINCT AXES — never merge them.
 *   FormEvent    = outbound, "what changed" (value-changed/state-changed/repeat-*)
 *   FormEntryEvent = inbound, "where is the cursor" (BOF/EOF/QUESTION/GROUP/REPEAT)
 *
 * Numeric codes mirror JavaRosa FormEntryController.EVENT_* constants for
 * direct equivalence assertions in ported tests.
 *
 * Slice 4.1: bof/eof/question/group variants only.
 * Slice 4.4: repeat/prompt-new-repeat variants added.
 */

/**
 * Numeric event codes — mirrors JavaRosa FormEntryController.EVENT_* constants.
 * REPEAT_JUNCTURE (32) is omitted; NON_LINEAR mode is out of scope.
 */
declare const FORM_ENTRY_EVENT: {
    readonly BEGINNING_OF_FORM: 0;
    readonly END_OF_FORM: 1;
    readonly PROMPT_NEW_REPEAT: 2;
    readonly QUESTION: 4;
    readonly GROUP: 8;
    readonly REPEAT: 16;
};
/**
 * Discriminated union for form entry cursor events.
 *
 * Each variant carries the FormIndex it was produced from, plus the numeric
 * code that matches JavaRosa EVENT_* for direct equivalence assertions.
 *
 * Slice 4.1: only bof/eof/question/group variants are instantiated by
 * FormNavigator. The repeat/prompt-new-repeat variants are added in Slice 4.4.
 */
type FormEntryEvent = {
    readonly kind: 'beginning-of-form';
    readonly code: 0;
    readonly index: FormIndex;
} | {
    readonly kind: 'end-of-form';
    readonly code: 1;
    readonly index: FormIndex;
} | {
    readonly kind: 'prompt-new-repeat';
    readonly code: 2;
    readonly index: AtFormIndex;
} | {
    readonly kind: 'question';
    readonly code: 4;
    readonly index: AtFormIndex;
} | {
    readonly kind: 'group';
    readonly code: 8;
    readonly index: AtFormIndex;
} | {
    readonly kind: 'repeat';
    readonly code: 16;
    readonly index: AtFormIndex;
};

/**
 * FormNavigator — form entry cursor engine (Phase 4).
 *
 * @experimental Phase 4 cursor API. NOT exported from any stable barrel.
 *
 * Owns the mutable cursor (FormIndex) and provides query and navigation
 * methods that mirror JavaRosa FormEntryController + FormEntryModel.
 *
 * Firewall: ZERO XPath imports. Relevance routing goes exclusively through
 * FormEvaluator.isEffectivelyRelevant. The XPathSeam is NOT imported here.
 * indexOf() parsing is isolated to a single parseAbsoluteRef call; no XPath
 * engine internals cross this module boundary.
 */

interface ResolvedPath {
    /** The leaf FormElement at the end of the path. */
    element: FormElement;
    /** Chain from root → leaf (parent elements, excluding the leaf). */
    parentChain: readonly FormElement[];
    /** The concrete TreeReference built while walking the path. */
    ref: TreeReference;
}
/**
 * @experimental
 */
declare class FormNavigator {
    private readonly definition;
    private readonly tree;
    private readonly evaluator;
    /** Current cursor position. Starts at BOF. */
    private currentIndex;
    constructor(definition: FormDefinition, tree: InstanceTree, evaluator: FormEvaluator);
    /**
     * @experimental
     * Returns the current cursor position.
     */
    getCurrentIndex(): FormIndex;
    /**
     * @experimental
     * Returns true when the cursor is past the last event (EOF).
     */
    atTheEndOfForm(): boolean;
    /**
     * @experimental
     * Returns true when the cursor is positioned AT a question element.
     */
    atQuestion(): boolean;
    /**
     * @experimental
     * Returns the TreeReference for the given index (defaults to current cursor).
     * Returns null when the index is BOF or EOF.
     */
    refAtIndex(idx?: FormIndex): TreeReference | null;
    /**
     * @experimental
     * Returns the TreeReference at the NEXT relevant position without permanently
     * moving the cursor. Mirrors JavaRosa Scenario.nextRef() which does:
     *   silentNext(); ref = refAtIndex(); silentPrev(); return ref.
     *
     * This is relevance-aware (skips non-relevant positions) but NON-MUTATING:
     * it does NOT call createModelIfNecessary (no instance-tree side effects).
     * Returns null when the next relevant position is EOF.
     */
    nextRef(): TreeReference | null;
    /**
     * Returns true when `idx` is a count-controlled repeat junction whose
     * instance does not exist AND whose multiplicity has reached (or exceeded)
     * the count expression value — meaning createModelIfNecessary would skip it.
     * Non-mutating: does NOT create any instances.
     */
    private isExhaustedCountRepeat;
    /**
     * @experimental
     * Classify a FormIndex into a FormEntryEvent without moving the cursor.
     * Mirrors JavaRosa FormEntryModel.getEvent(FormIndex).
     */
    eventAt(idx: FormIndex): FormEntryEvent;
    /**
     * @experimental
     * Convenience alias: eventAt(idx ?? currentIndex).
     * Mirrors JavaRosa FormEntryController.getEvent().
     */
    getEvent(idx?: FormIndex): FormEntryEvent;
    /**
     * @experimental
     * Returns the next FormIndex after `idx`, descending into containers when
     * `descend` is true (default). Relevance-blind — use stepToNextEvent() for
     * the relevance-skipping stepping API.
     *
     * Ported from FormEntryModel.incrementIndex(FormIndex, boolean) + incrementHelper.
     */
    incrementIndex(idx: FormIndex, descend?: boolean): FormIndex;
    /**
     * @experimental
     * Returns the previous FormIndex before `idx`. Relevance-blind.
     *
     * Ported from FormEntryModel.decrementIndex(FormIndex) + decrementHelper.
     */
    decrementIndex(idx: FormIndex): FormIndex;
    /**
     * Returns true when an AtFormIndex position is a stop that the user should
     * see. Non-relevant positions are skipped.
     *
     * Delegates to FormEvaluator.isEffectivelyRelevant (which walks the full
     * ancestor chain via NodeState), so a non-relevant group's descendants are
     * automatically non-relevant without additional per-child checks (R4.3.5).
     *
     * For PROMPT_NEW_REPEAT positions, the repeat's own relevance is checked
     * via the genericized ref (the concrete ref has multiplicity=0 but the
     * relevance condition is stored under the generic key).
     */
    private isStopRelevant;
    /**
     * @experimental
     * Advance cursor, skipping non-relevant positions, until a relevant stop or
     * EOF is reached. Sets currentIndex and returns the event at the new position.
     *
     * Mirrors JavaRosa FormEntryController.stepToNextEvent (LINEAR mode):
     *   do { next = incrementIndex(next) } while next is at && not relevant
     *
     * After landing on a new position, calls createModelIfNecessary to
     * auto-create repeat instances when jr:count controls the repeat size
     * (mirrors JR FormEntryModel.setQuestionIndex → createModelIfNecessary).
     */
    stepToNextEvent(): FormEntryEvent;
    /**
     * Mirrors JavaRosa FormEntryModel.createModelIfNecessary.
     * If the position is a count-controlled repeat (jr:count) and the instance
     * at the current multiplicity doesn't exist yet AND multiplicity < count,
     * auto-create the repeat instance.
     *
     * This enables navigation INTO count-controlled repeats via next() without
     * requiring an explicit createNewRepeat() call (matching JR behavior).
     */
    private createModelIfNecessary;
    /**
     * @experimental
     * Retreat cursor, skipping non-relevant positions, until a relevant stop or
     * BOF is reached. Sets currentIndex and returns the event at the new position.
     *
     * Mirrors the symmetric stepToPreviousEvent.
     */
    stepToPreviousEvent(): FormEntryEvent;
    /**
     * @experimental
     * Set cursor to `idx` and return the event at that position.
     */
    jumpToIndex(idx: FormIndex): FormEntryEvent;
    /**
     * @experimental
     * Reset cursor to BOF.
     */
    jumpToBeginningOfForm(): FormEntryEvent;
    /**
     * @experimental
     * Walk the form from BOF (relevance-blind) and return the first AtFormIndex
     * whose ref matches `xPath`. Returns endOfForm if not found.
     *
     * Positional xPath (e.g. /data/repeat[1]/q): compared with concrete ref
     * (includes multiplicity). Generic xPath (no predicates): compared with
     * genericized ref (ignores multiplicity).
     *
     * XPath firewall: only parseAbsoluteRef() crosses this boundary — no XPath
     * engine internals are imported.
     */
    indexOf(xPath: string): FormIndex;
    /**
     * Compare a walker ref against the parsed target ref.
     *
     * Per-level rule (mirrors JavaRosa FormEntryModel.getIndexByReference):
     *   - If the target level has a concrete multiplicity (>= 0): exact match required.
     *   - If the target level has INDEX_UNBOUND (-1): name match only (any multiplicity).
     *
     * This handles mixed refs like /data/repeat[1]/inner1 where repeat[1] is
     * positional but inner1 has no predicate.
     */
    private refMatchesTarget;
    /**
     * @experimental
     * Returns a question wrapper for the element at the given index (defaults to
     * current cursor). Returns null when not at a question position.
     *
     * The returned object exposes:
     *   - getLabelInnerText(): label text with <output> replaced by ${n} placeholders
     *   - getControlType(): the control type string (e.g. 'input', 'select1')
     *
     * R4.5.2: walks FormDefinition.body via resolvePath — O(depth). No XPath eval.
     * R4.5.8: does NOT trigger XPath evaluation or modify InstanceTree.
     */
    getQuestionAtIndex(idx?: FormIndex): {
        getLabelInnerText(): string | null;
        getControlType(): string;
        getDataType(): DataType | null;
        getHintText(): string | null;
        getRangeBounds(): {
            start?: number;
            end?: number;
            step?: number;
        } | null;
        getAppearance(): string | null;
        getMediatype(): string | null;
        getQuestionText(): string | null;
        getSubstitutedHintText(): string | null;
    } | null;
    /**
     * @experimental
     * Jump to the PROMPT_NEW_REPEAT position for the innermost repeat that
     * contains the current cursor. Sets currentIndex and returns the event.
     *
     * If the cursor is not inside any repeat, this is a no-op (cursor unchanged,
     * returns the current event). Mirrors JavaRosa FormEntryController.jumpToNewRepeatPrompt().
     *
     * Algorithm:
     *   1. Walk the current index's path from leaf to root to find the innermost
     *      level whose element is a repeat.
     *   2. Set the path to that repeat level, with multiplicity incremented by 1
     *      (the next instance slot, which has no instance → PROMPT_NEW_REPEAT).
     *   3. If no repeat ancestor is found, do nothing.
     */
    jumpToNewRepeatPrompt(): FormEntryEvent;
    /**
     * @experimental
     * Enter the nth repeat instance (0-indexed) for the repeat at the current
     * cursor position. Sets currentIndex to the repeat node at multiplicity n
     * and returns the event (REPEAT if instance exists, PROMPT_NEW_REPEAT otherwise).
     *
     * The cursor must already be positioned at or within a repeat node.
     * Mirrors JavaRosa FormEntryController.descendIntoRepeat(int n).
     */
    descendIntoRepeat(n: number): FormEntryEvent;
    /**
     * @experimental
     * Deletes the repeat instance referenced by `idx` (defaults to the current
     * cursor) and returns the FormEntryEvent for the post-removal cursor
     * position. Mirrors JavaRosa FormEntryController.deleteRepeat(FormIndex) /
     * FormDef.deleteRepeat, composed from two existing, unchanged primitives:
     *
     *   1. removeRepeatInstance(tree, ref) — splices the instance and
     *      re-indexes sibling multiplicities (data layer, unchanged).
     *   2. evaluator.triggerRepeatRemoval(genericRef) — re-runs the DAG
     *      cascade so relevant/required/calculate/constraint are recomputed
     *      (unchanged; full-DAG-rerun cost is a known, accepted limitation).
     *
     * No new recomputation logic is introduced.
     *
     * Cursor re-mapping (design decision 3, JavaRosa-pinned): let `m` be the
     * removed instance's multiplicity. The cursor is rebuilt via
     * buildFormIndex + eventAt reclassification in every case, never reused
     * as-is:
     *   (a) cursor was AT or inside the removed instance (multiplicity === m)
     *       -> truncated to the repeat level at multiplicity m (now the
     *       shifted-down sibling, or empty -> PROMPT_NEW_REPEAT).
     *   (b) cursor was in a later sibling (multiplicity > m) -> same logical
     *       node, multiplicity decremented by 1 to track the re-index.
     *   (c) cursor was in an earlier sibling, outside the repeat entirely, or
     *       otherwise unrelated -> unchanged position, ref regenerated fresh.
     *
     * Throws (fail loudly, no silent no-op / soft-result object) when:
     *   - idx is BOF/EOF (not resolvable)
     *   - idx's path has no repeat ancestor
     *   - the resolved repeat's countExpr is non-null (jr:count-bound; count
     *     is engine-controlled, matches JavaRosa/Collect semantics)
     *   - removeRepeatInstance returns null (out-of-range multiplicity / no
     *     backing instance, e.g. a PROMPT_NEW_REPEAT slot)
     * All validation throws happen BEFORE removeRepeatInstance / cascade /
     * cache invalidation are called — no partial mutation on rejection.
     *
     * Zero XPath imports (firewall preserved) — reuses genericize, buildRef,
     * buildFormIndex, elementAt, eventAt already available in this module.
     */
    deleteRepeat(idx?: FormIndex): FormEntryEvent;
    /**
     * Rebuild `this.currentIndex` after a repeat instance removal, per design
     * decision 3 (cases a-d). ALWAYS rebuilds through buildFormIndex (never
     * reuses the old immutable ref) and classifies via eventAt at the call
     * site (deleteRepeat).
     */
    private remapCursorAfterRemoval;
    /** Returns true when curPath[0..upTo-1] equals ancestorLevels[0..upTo-1] (elementIndex + multiplicity). */
    private pathPrefixMatches;
    /**
     * Walk FormDefinition.body using the path levels to find the leaf element.
     * Also reconstructs the concrete TreeReference (used for classifying repeats,
     * relevance checks, and element lookup).
     *
     * Returns null only when the path is structurally invalid (should not happen
     * with well-formed FormIndex values produced by incrementIndex).
     */
    resolvePath(path: readonly FormIndexLevel[]): ResolvedPath | null;
    /**
     * Extract the last segment name from a FormElement's TreeReference.
     * This is the element's own local name in the body/instance tree.
     */
    private elementLeafName;
    /**
     * Get the element at the given mutable levels array (leaf element).
     * Returns null if path is invalid.
     */
    private elementAt;
    /**
     * Get the children array for the element at `levels`, or body if levels is empty.
     */
    private childrenOf;
    /**
     * Build the concrete ref for the element at the given mutable levels array.
     *
     * Multiplicity is applied ONLY for repeat elements (concrete instance
     * position). For questions and groups the multiplicity in the path is
     * always 0 (by algorithm), so we use INDEX_UNBOUND there — keeping the
     * ref in the same form as the binding key (refToString generic) that
     * FormEvaluator uses for constraint / relevance lookups.
     *
     * For repeat elements the concrete multiplicity IS carried (needed for
     * resolveReference instance-existence checks and per-instance relevance).
     */
    private buildRef;
    /**
     * Convert mutable levels array to an immutable AtFormIndex.
     */
    private buildFormIndex;
    /**
     * Ported from FormEntryModel.incrementHelper (LINEAR mode, java:548-642).
     * Mutates `levels` in place to advance to the next position.
     */
    private incrementHelper;
    /**
     * Ported from FormEntryModel.decrementHelper (LINEAR mode, java:672-719).
     * Mutates `levels` in place to retreat to the previous position.
     */
    private decrementHelper;
    /**
     * Ported from FormEntryModel.setRepeatNextMultiplicity (LINEAR mode, java:721-742).
     *
     * If the leaf element in `levels` is a repeat, count existing instances and
     * set multiplicity to `count - 1` (last instance) if instances exist, or 0
     * (which will yield PROMPT_NEW_REPEAT) if none.
     *
     * Returns true if the leaf is a repeat (multiplicity was set), false otherwise.
     */
    private setRepeatNextMultiplicity;
}

/**
 * PreloadProvider — injectable seam for non-deterministic preload primitives.
 *
 * Design ADR-1: The preload TYPE dispatch (date/timestamp/uid/property) lives in
 * resolvePreload(); this interface supplies only the three non-deterministic
 * primitives. Mirrors the Phase 6 uuid-provider philosophy.
 *
 * T-VAL-3: defaultPreloadProvider.uid delegates to the Phase 6 uuid seam
 * (src/xpath/functions/xforms-uuid.ts setUuidGenerator / activeUuidGenerator)
 * via a direct call path so there is only ONE uuid generator seam in the codebase.
 */
interface PreloadProvider {
    /** Current wall-clock instant. Used by 'date' and 'timestamp'. */
    now(): Date;
    /** RFC-4122 uuid WITHOUT the "uuid:" prefix (resolvePreload adds it). */
    uid(): string;
    /** Device/app property by name (deviceid, phonenumber, ...). null if unknown. */
    property(name: string): string | null;
}
declare const defaultPreloadProvider: PreloadProvider;
interface FrozenPreloadOptions {
    /** Fixed instant returned by now(). Default: 2020-01-01T00:00:00.000Z */
    now?: Date;
    /** Fixed UUID string returned by uid(). Default: '00000000-0000-4000-8000-000000000000' */
    uid?: string;
    /** Named properties returned by property(name). Default: {} (all null) */
    properties?: Record<string, string>;
}
/**
 * Returns a PreloadProvider that yields fixed, reproducible values.
 * Used in tests to make preloaded node values deterministic.
 */
declare function frozenPreloadProvider(opts?: FrozenPreloadOptions): PreloadProvider;

/**
 * FormSession — mutable run-state for a form evaluation session.
 *
 * Slice 3.1 skeleton + Slice 3.4 extension:
 *   - Carries FormDefinition (includes compiled DAG from Slice 3.3)
 *   - Creates FormEvaluator wired to the InstanceTree
 *   - Calls evaluator.initializeInstance(dag) to compute initial calculate values
 */

interface FormSession {
    /** The full form definition (immutable defs + compiled bindings + DAG). */
    readonly definition: FormDefinition;
    /** The mutable instance data tree (Option A: sole data store, no parallel DOM). */
    readonly tree: InstanceTree;
    /** The evaluator wired to this session's InstanceTree. */
    readonly evaluator: FormEvaluator;
    /**
     * @experimental The form entry cursor engine (Phase 4).
     * Owns the mutable cursor and all navigation methods.
     */
    readonly navigator: FormNavigator;
    /**
     * Serialize the primary instance to ODK-submission XML.
     *
     * Applies JavaRosa-default filtering: omits non-relevant nodes and
     * INDEX_TEMPLATE nodes. Relevance is determined via FormEvaluator.isNodeRelevant,
     * which reuses the proven nodeToRef + isEffectivelyRelevant path (ADR-2).
     *
     * No XML declaration is emitted (mirrors JavaRosa XFormSerializingVisitor).
     *
     * Slice 6a — serialization-odk-functions
     */
    readonly serializeToXml: () => string;
}
/** Options for createFormSession (Phase 7, Slice 7-INFRA-A). */
interface CreateFormSessionOpts {
    /** Injectable preload provider. Defaults to defaultPreloadProvider (live wall-clock). */
    preloadProvider?: PreloadProvider;
    /**
     * Previously-submitted ODK instance XML to hydrate the session from, for
     * editing an existing submission (sdd/instance-editing-hydration).
     *
     * Additive, opt-in: when absent, session creation is 100% unchanged from
     * the template-defaults path. When present, the session's working tree is
     * built via `hydrateInstance(definition, instanceXml)` instead of using
     * `definition.mainInstance` directly, and `applyPreloads` is skipped
     * (ADR-C) so original submission timestamps/uids are preserved. The DAG
     * cascade still runs unconditionally afterwards (calculate always wins
     * over loaded values, per design decision 1).
     */
    instanceXml?: string;
}
/**
 * Create a FormSession from a FormDefinition.
 *
 * Runs initializeInstance on the DAG so all calculate expressions are
 * evaluated in topological order before the first user interaction.
 *
 * Phase 7: applyPreloads runs BEFORE initializeInstance so preloaded
 * dates/uids are visible to calculate expressions (T-VAL-2 ordering).
 *
 * sdd/instance-editing-hydration: when `opts.instanceXml` is provided, the
 * working tree is hydrated from it instead of using `definition.mainInstance`
 * directly, and `applyPreloads` is skipped (ADR-C). When absent, behavior is
 * unchanged from before this change.
 */
declare function createFormSession(definition: FormDefinition, opts?: CreateFormSessionOpts): FormSession;

/**
 * InstanceHydrator — populate a fresh InstanceTree from a previously-submitted
 * ODK instance XML, for editing an existing submission.
 *
 * Pure module: no dependency on FormSession/FormEvaluator/FormNavigator.
 * Depends only on InstanceNode/InstanceTree primitives, codecs.cast, the
 * XmlParser seam, and domHelpers.
 *
 * Algorithm (design §3): parallel walk of the definition template tree
 * (`definition.mainInstance.root`) against the parsed submission XML DOM.
 * The template is authoritative for structure/types; the XML is authoritative
 * for values and repeat multiplicity.
 *
 * Drift policy (design ADR-E): strict on extras (throw HydrationError),
 * default-fill on missing template nodes, throw on cast failure.
 *
 * sdd/instance-editing-hydration, PR1 — tasks 1-11.
 */

/**
 * Thrown for any hydration drift: root-name mismatch, unknown/extra XML
 * nodes not present in the template, unexpected multiplicity on a
 * non-repeat node, or a value that fails `cast()`. Always includes the
 * offending node's path (design ADR-E error contract).
 */
declare class HydrationError extends Error {
    constructor(message: string);
}
/**
 * Hydrate a fresh InstanceTree from a previously-submitted instance XML,
 * using `definition`'s template tree for structure, types, and repeat
 * templates.
 *
 * Does NOT mutate `definition.mainInstance` — the definition's template
 * tree is cloned before population (design ADR-A), so the returned tree is
 * independent and hydration is repeatable.
 */
declare function hydrateInstance(definition: FormDefinition, instanceXml: string): InstanceTree;

/**
 * XmlParser — environment-injection seam.
 *
 * The core engine never calls `new DOMParser()` directly. Instead it
 * retrieves the active provider via `getXmlParser()`. Test and RN
 * environments register their own provider via `registerXmlParser()`
 * before any parse call is made (typically in Vitest setupFiles or the
 * RN app bootstrap).
 *
 * Design constraint (from architecture decision record):
 *   - `src/` MUST NOT import Node globals, browser globals, or
 *     `@xmldom/xmldom` directly. Those belong in platform adapters
 *     under `tests/` or an `adapters/` package.
 *   - The `Document` type here is the structural DOM Document interface
 *     (part of the "DOM" lib in tsconfig), not a concrete implementation.
 */
/**
 * Minimal XML parser seam.
 * Implementations must return a DOM-compatible Document for well-formed XML.
 */
interface XmlParser {
    parse(xml: string): Document;
    /**
     * Optional stub-document factory.
     *
     * Some engine internals (e.g. the XPath seam) need a minimal, valid DOM
     * Document to use as a context node when no real instance is available.
     * Providers that back the engine in an environment where XPath evaluation
     * happens (tests, RN bootstrap) MUST implement this; providers that only
     * ever parse real XML (rare) may omit it, in which case callers relying on
     * the stub document will get a clear, actionable error.
     */
    createDocument?(rootTagName: string): Document;
}
/**
 * Register the active XmlParser provider.
 * Call this once during environment bootstrap (setupFiles, app init, etc.)
 * before any code that calls `getXmlParser()`.
 */
declare function registerXmlParser(provider: XmlParser): void;
/**
 * Retrieve the registered XmlParser provider.
 * Throws if no provider has been registered, making misconfiguration
 * immediately visible rather than producing a silent null-deref.
 */
declare function getXmlParser(): XmlParser;

/**
 * ExternalInstanceResolver — environment-injection seam for `jr://` external
 * secondary instance sources.
 *
 * The core engine never fetches files or network resources directly to
 * resolve `<instance id="..." src="jr://...">` declarations. Instead it
 * retrieves the active provider via `getExternalInstanceResolver()`. Hosts
 * (and the test environment) register their own provider via
 * `registerExternalInstanceResolver()` before calling `resolveExternalInstances`.
 *
 * Mirrors the `XmlParser` seam convention exactly (see `./XmlParser.ts`).
 */
/**
 * Minimal external instance resolver seam.
 * Implementations must return the raw UTF-8 text content for a given `jr://`
 * (or other scheme) URI, or `null` when there is no content available for
 * that URI (e.g. `jr://instance/last-saved` with no prior submission). The
 * engine owns all content-format parsing (e.g. CSV); the resolver only
 * fetches bytes/text. Interpretation of a `null` result is the
 * responsibility of the calling dispatch logic, not this seam.
 */
interface ExternalInstanceResolver {
    resolve(uri: string): Promise<string | null>;
}
/**
 * Register the active ExternalInstanceResolver provider.
 * Call this once during environment bootstrap (setupFiles, app init, etc.)
 * before any code that calls `getExternalInstanceResolver()`.
 */
declare function registerExternalInstanceResolver(provider: ExternalInstanceResolver): void;
/**
 * Retrieve the registered ExternalInstanceResolver provider.
 * Throws if no provider has been registered, making misconfiguration
 * immediately visible rather than producing a silent null-deref.
 */
declare function getExternalInstanceResolver(): ExternalInstanceResolver;

/**
 * resolveExternalInstances — async hydration step for `jr://` external
 * secondary instances (design §6, spec R4).
 *
 * Fetches raw content for each declared `FormDefinition.externalInstances`
 * entry via the registered `ExternalInstanceResolver` and dispatches on the
 * declared `src`:
 *   - `jr://instance/last-saved` (spec: last-saved instance) is parsed as
 *     XML using the same inline-secondary-instance tree-building machinery
 *     (`buildInstanceNode` + `applyBindings`), with relaxed/tolerant schema
 *     drift handling. A `null` resolver result (no prior submission) yields
 *     an empty-root tree rather than an error (ADR-3).
 *   - A `src` ending in `.xml` (case-insensitive), other than the exact
 *     last-saved literal, is parsed as XML via the same shared tree-building
 *     machinery, but fail-loud: a `null` resolver result or malformed/rootless
 *     XML throws (unlike last-saved's relaxed handling).
 *   - Any other `src` keeps the existing CSV resolution path, unchanged.
 *
 * `parseForm` stays synchronous/pure; this step is the only place I/O
 * happens.
 *
 * Fail-loud (spec R5): a rejecting resolver, a `null` CSV or `.xml` result,
 * malformed CSV, or malformed last-saved/external XML all throw with an
 * operation-prefixed message identifying the offending instance id/src. An
 * unregistered resolver seam propagates its own error unchanged.
 */

declare function resolveExternalInstances(definition: FormDefinition): Promise<FormDefinition>;

export { AnswerResult, type AnswerValue, type AtFormIndex, type ChoiceItem, type ControlType, type CreateFormSessionOpts, DEFAULT_MULTIPLICITY, type DataBinding, type DataType, type ExternalInstanceResolver, FORM_ENTRY_EVENT, type FormDefinition, type FormElement, type FormEntryEvent, FormEvaluator, type FormEvaluatorOptions, type FormIndex, type FormIndexLevel, FormNavigator, type FormSession, type FrozenPreloadOptions, type GeoPoint, HydrationError, INDEX_ATTRIBUTE, INDEX_TEMPLATE, INDEX_UNBOUND, type InstanceNode, type InstanceTree, type Multiplicity, type NewNodeOptions, type NodeState, type PreloadProvider, REF_ABSOLUTE, type RefContext, type SelectChoice, type SelectChoiceRef, type TreeReference, type TreeReferenceLevel, type ValidateOutcome, type XPathPredicate, type XmlParser, addRepeatInstance, appendChild, atIndex, attributeNames, beginningOfForm, booleanValue, cast, childrenNamed, cloneNode, contextualize, controlTypeFromTag, countRepeatInstances, createFormSession, dataTypeFromXsdName, dateValue, decimalValue, defaultPreloadProvider, deleteAttribute, endOfForm, extendRef, frozenPreloadProvider, genericize, getAttribute, getExternalInstanceResolver, getXmlParser, hydrateInstance, intValue, isAt, isBof, isEof, level, newNode, nthRealChildNamed, parentOf, parseAbsoluteRef, parseDocument, parseForm, realChildrenNamed, refEquals, refToString, registerExternalInstanceResolver, registerXmlParser, removeRepeatInstance, resolveAll, resolveAllContextualized, resolveAllWithin, resolveExternalInstances, resolveReference, rootRef, selectMultiValue, selectOneValue, selfRef, setAttribute, stringValue, uncast, walkControls };
