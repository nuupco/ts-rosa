# ts-rosa — Engine Architecture

> Global high-level design for `@nuup/ts-rosa`: a behavior-compatible TypeScript
> reimplementation of JavaRosa (W3C XForms + ODK), targeting mobile (React Native /
> Hermes). This is the architecture of the WHOLE engine, not just the Phase 0 harness.
>
> Guiding criterion: **behavior compatibility with JavaRosa**, validated by the
> Scenario/fixtures equivalence harness. We replicate behavior, modernize design.

---

## 1. Design principles

1. **Portable core, injected I/O.** The engine core has ZERO dependencies on Node or
   browser globals. Anything environment-specific (XML parsing, file/secondary-instance
   loading, time, randomness) enters through injected interfaces. Portable to Hermes by
   construction.
2. **Behavior over code.** We do not translate Java line-by-line. We replicate observable
   behavior (XPath coercions, DAG order, relevance/serialization semantics) and verify it
   with ported tests.
3. **Separate the trees, separate concerns.** Definition tree (immutable) and instance
   tree (mutable) stay decoupled, bridged only by `TreeReference`. UI/derived state is
   separated from the data node (fixes the audit's flagged coupling, §10.3).
4. **Typed boundaries.** Discriminated unions for values, events, indices and AST nodes;
   exhaustive `switch` over `instanceof`/`int` constants.
5. **Pure where possible, controlled mutation where it pays.** The DAG is the single owner
   of reactive state; evaluation derives node state rather than scattering flags.
6. **No reactive runtime in the core; reactivity injected at the edge.** The engine mutates
   plain objects and emits a typed `FormEvent` stream. The client injects its own reactive
   system (Zustand/Jotai/Solid/Vue) through an injectable factory at the boundary, inspired by
   @getodk/xforms-engine's `OpaqueReactiveObjectFactory`. The core never imports a signals
   library (no Solid).
7. **Build vs Adopt, deliberately.** We do NOT fork @getodk/xforms-engine wholesale (it is
   bound to `DOMParser` and Solid, with no React Native story). We DO fork and adapt
   @getodk/xpath (Apache-2.0) behind our own XPath seam. @getodk/xforms-engine and its
   `packages/scenario` are used only as design and equivalence references. See §12.

---

## 2. Module layout (`src/`)

Aligned with JavaRosa packages but modernized and flattened. Dependency arrows point
"depends on"; no cycles. `core/*` never imports `platform/*` concrete providers.

```
src/
  index.ts                  Public API surface (barrel) — minimal exports
  platform/                 Injected boundaries (interfaces + env providers)
    XmlParser.ts            interface { parse(xml): XmlDocument } — NEVER global DOMParser
    Clock.ts                now()/today() seam (deterministic in tests)
    Random.ts               random() seam (deterministic in tests)
    SecondaryInstanceLoader CSV/GeoJSON/XML resolver (caller-provided data)
    ReactiveObjectFactory.ts interface OpaqueReactiveObjectFactory<T> (client injects
                            Zustand/Jotai/Solid/Vue; core default = identity/no-op)
  model/                    Domain core (portable, no I/O)
    def/                    DEFINITION tree (immutable)
      FormDefinition.ts     root structure (NOT a God Object)
      FormElement.ts        union: GroupNode | RepeatNode | QuestionNode
      DataBinding.ts        <bind>: ref + compiled triggerable refs
      ItemsetBinding.ts     dynamic choices
      controlType.ts        string-union control types
    instance/               INSTANCE tree (mutable data only)
      InstanceTree.ts       primary instance + named secondary instances
      InstanceNode.ts       DATA only: name, multiplicity, value, children, attrs
      TreeReference.ts      immutable typed path (bridge def<->data<->xpath)
      TreeReferenceLevel.ts segment: name|'*', multiplicity, predicates
      multiplicity.ts       TEMPLATE/UNBOUND/ATTRIBUTE markers
    data/                   IAnswerData as discriminated union + pure cast/uncast
      AnswerValue.ts        union: StringValue | IntegerValue | DateValue | ...
      codecs.ts             Map<DataType, encoder/decoder> (exhaustive)
    state/                  DERIVED node state (separated from InstanceNode)
      NodeState.ts          { relevant, enabled, required, readonly, constraintMsg }
  eval/                     Reactivity (the DAG)
    Triggerable.ts          Condition | Recalculate as data, not behavior wrappers
    TriggerableDag.ts       topological graph; sole owner of cascade edges
    EvaluationContext.ts    contextNode, instance, secondary, functions, vars, position
  xpath/                    XPath engine (Phase 2, IMPLEMENTED)
    index.ts                Public seam barrel; re-exports from seam/XPathSeam.ts
    seam/XPathSeam.ts       ONLY XPath import boundary for the rest of the engine.
                            Exports: evaluateXPath, evaluateXPathTyped, compileXPath,
                            CompiledExpression, EvaluationContext, XPathValue
    evaluator/
      XmldomEvaluator.ts    Vendored Evaluator<XmldomNode> with injected pure-JS parser,
                            XmldomXPathAdapter, and FunctionLibraryCollection. No WASM.
    adapter/                XPathDOMAdapter<XmldomNode> over @xmldom/xmldom (~20 methods)
      XmldomXPathAdapter.ts   bridges xmldom nodes to the vendored evaluator
      XmldomNode.ts, kind.ts, traversal.ts, names.ts, values.ts
    parser/                 Pure-JS XPath 1.0 parser (NO WASM / tree-sitter)
      PureJSExpressionParser.ts  recursive-descent + precedence-climbing; LRU cache
      SyntaxNode.ts              ts-rosa SyntaxNode types (tree-sitter-compatible vocabulary)
      Tokenizer.ts               lexer → Token[]
    functions/
      index.ts              FunctionLibraryCollection: XPath 1.0 + ODK/jr: + xforms fns
    vendor/                 Vendored source (Apache-2.0, upstream commit c02a421)
      VENDOR.md             Provenance: repo, commit, license, what was pruned
      PATCHES.md            8 conformance patches — MUST re-apply on re-vendor
      common/               Subset of @getodk/common (pure-TS, no browser globals)
      xpath/                Subset of @getodk/xpath (Evaluator, interfaces, functions)
  parse/                    XForm -> model (uses XmlParser via injection)
    XFormParser.ts          instance-scoped (no static parseLock/handlers)
    handlers.ts             Map<tag, Handler> dispatch
    bindProcessor.ts        compile relevant/required/calculate/constraint -> Triggerable
  session/                  Form-filling application layer
    FormSession.ts          mutable fill state (answers, repeat instances, node states)
    FormEvaluator.ts        drives Triggerable evaluation over a session
    FormIndex.ts            immutable navigation cursor (union)
    navigation.ts           stepToNext/Prev -> FormEvent
    events.ts               FormEvent discriminated union
    AnswerResult.ts         OK | REQUIRED_BUT_EMPTY | CONSTRAINT_VIOLATED
    prompt.ts               read-only QuestionView/GroupView snapshot for UI
  serialize/
    serializeInstance.ts    instance -> submission XML (relevance + template filtering)

tests/                      Phase 0 harness lives here (NEVER in src/)
  harness/ (DSL, Scenario, matchers, XmlParser provider) · fixtures/ · dag/ · rn-smoke/
adapters/ (future, separate entrypoint)  react/useFormSession hook (NOT in core)
```

---

## 3. The two trees and the bridge

| Concern | Type | Mutability | Notes |
|---|---|---|---|
| Definition | `FormDefinition` + `FormElement` union | Immutable after parse | structure, labels, control type, binding |
| Instance (data) | `InstanceTree` + `InstanceNode` | Mutable during fill | name, multiplicity, value, children, attrs ONLY |
| Derived UI state | `NodeState` (keyed by node identity) | Recomputed by DAG | relevant/enabled/required/readonly + constraint msg |
| Bridge | `TreeReference` (immutable) | — | absolute/relative path, predicates, instance name |

**Typing strategy.** Definition and instance nodes are **discriminated unions** (tag field
`kind`), not class hierarchies. Reasons: exhaustive checks, structural cloning for repeats,
trivial serialization, and friendliness to Hermes (no deep prototype chains). Behavior that
in Java lived on the class becomes pure functions over the union (`evaluate(node)`,
`castValue(value, type)`).

**Key fix (audit §10.3).** `NodeState` is split out of the data node. `InstanceNode` carries
data only; relevance/enabled/required/readonly live in a `NodeState` map owned by the
evaluator. This is the decoupling the audit explicitly flagged.

---

## 4. MAJOR DECISION — reactivity model (CONFIRMED: Hybrid, option (c))

JavaRosa recomputes relevance/calculate/required/readonly through a topological DAG of
triggerables, mutating flags on `TreeElement`. We must preserve observable behavior
(evaluation order, cascade expansion, cycle detection) while improving the design and
staying mobile-friendly. The decision is **firm: option (c), the Hybrid model.** The
alternatives below are kept only as recorded rationale for why (a) and (b) were rejected.

| Option | Fidelity to JR | Complexity | Mobile perf | Testability | React/RN fit |
|---|---|---|---|---|---|
| (a) Faithful mutable DAG (state flags on nodes, JR-style) | Highest (1:1) | Low-Med (proven algo) | Good (compute once on load, incremental on change) | Med (mutation harder to assert) | Poor (manual observers, leak-prone — the audit's complaint) |
| (b) Immutable state + derived recompute (signals/observables) | Med (must re-derive JR cascade semantics on top of a different model; risk of order drift) | High (full reactive runtime, GC churn) | Risk (broad recompute / allocation pressure on Hermes) | High (pure derivations) | Excellent (signals map to hooks) |
| (c) **Hybrid: precomputed topological DAG + evaluation state SEPARATE from the data tree** (CHOSEN) | High (same topo order + cascade expansion as JR, verified by TriggerableDagTest) | Med | Good (incremental: only re-evaluate the affected cascade slice) | High (DAG order is pure/inspectable; NodeState is a plain map) | Good (session exposes immutable snapshots + change events; adapter layer turns them into hook state) |

### Decision: Option (c) — Hybrid (CONFIRMED)

The hybrid model rests on four concrete commitments:

**4.1 — Explicit topological DAG computed at parse-time (JavaRosa-faithful).**
The `TriggerableDag` is built once during parse, exactly as JavaRosa does:

- a deterministic **topological ordering** of all triggerables (condition/recalculate),
- **cascade expansion** (a triggerable's downstream dependents, transitively), and
- **cycle detection** (rejects self-referential calculate/relevance graphs).

This precomputed graph IS the conformance contract, validated by the ported
`TriggerableDagTest`. No evaluation order is discovered lazily at runtime; the order is a
parse-time artifact that can be inspected and asserted.

**4.2 — Evaluation state separate from the data tree.**
`NodeState` (`relevant`/`enabled`/`required`/`readonly` + computed values) lives in a map
**owned by the `FormEvaluator`**, NOT on `InstanceNode`. The instance tree carries data only.
This fixes the audit's §10.3 coupling and makes evaluation results a pure, inspectable map.

**4.3 — Core mutates plain objects; the client injects reactivity via a factory.**
The engine has NO reactive runtime (no Solid, no RxJS). It mutates plain objects and exposes
state through a factory the client supplies — directly inspired by @getodk/xforms-engine's
`OpaqueReactiveObjectFactory`. The core wraps any state object it hands out through this
factory; the default implementation is the identity function (plain mutation, no reactivity).
At the edge, React Native / web inject a factory backed by their own system (Zustand, Jotai,
Solid, Vue), so reads become reactive in the host framework without the core knowing how.

```ts
// platform/ReactiveObjectFactory.ts
// Inspired by @getodk/xforms-engine OpaqueReactiveObjectFactory.
// The engine calls this to wrap every mutable state object it exposes.
// `T` must be an object; the returned value is structurally identical to the
// input but may be backed by the client's reactive system.
export interface OpaqueReactiveObjectFactory {
  <T extends object>(initial: T): T;
}

// Core default: no reactivity, plain mutation.
export const identityReactiveFactory: OpaqueReactiveObjectFactory = (initial) => initial;

// Edge example (NOT in core):
//   const solidFactory: OpaqueReactiveObjectFactory = (initial) => createMutable(initial);
//   const zustandFactory = ... // backed by a store
```

**4.4 — Signal-like ergonomics at the edge via the FormEvent stream.**
`FormSession` emits a typed `FormEvent` stream plus immutable read snapshots. The `adapters/`
layer (`adapters/react`) turns those into hook state. Combined with the injected factory, the
client gets signal-like reactivity at the boundary while the equivalence core stays
synchronous and dependency-free.

**Data flow.**

```
parse-time:   XForm --parse--> TriggerableDag (topo order + cascades + cycle check)  [immutable]
runtime:      answer(value) --> FormEvaluator re-evals affected cascade slice only
                            --> mutates NodeState map + computed values (plain objects,
                                wrapped by injected OpaqueReactiveObjectFactory)
                            --> emits FormEvent on the session stream
edge:         adapters/react  --> useFormSession() subscribes -> hook state (reactive in host)
```

**Why not (a).** The pure mutable-flag-on-node model reproduces exactly the coupling and
observer fragility the audit asked us to redesign, and is the worst fit for React.

**Why not (b).** A full immutable/signals core risks DRIFTING from JavaRosa's precise
evaluation order (our hard equivalence requirement) and adds allocation/GC pressure that is
exactly what hurts on Hermes. Reactivity belongs at the UI edge — injected via the factory —
not baked into the equivalence core.

---

## 5. FormDef God Object split (audit §10.3)

| New unit | Owns | Does NOT own |
|---|---|---|
| `FormDefinition` | immutable structure, bindings, compiled triggerables, the static DAG topology | runtime values, navigation, evaluation |
| `FormSession` | mutable fill state: answer values, repeat instances, `NodeState` map, current `FormIndex` | structure, XPath evaluation logic |
| `FormEvaluator` | runs triggerables over a session, applies cascades, validates constraints | structure, navigation cursor |

`FormDefinition` is parsed once and shared/immutable; many `FormSession`s could run against
one `FormDefinition`. Navigation (`navigation.ts`) reads session + definition, never mutates
structure, and creating a repeat is an explicit session operation (fixes "navigation creates
repeats as side effect", §10.3).

---

## 6. Navigation events (audit §10.3)

Replace `int EVENT_*` with a discriminated union:

```ts
type FormEvent =
  | { kind: 'beginning-of-form' }
  | { kind: 'end-of-form' }
  | { kind: 'question'; index: FormIndex }
  | { kind: 'group'; index: FormIndex }
  | { kind: 'repeat'; index: FormIndex }
  | { kind: 'prompt-new-repeat'; index: FormIndex }
  | { kind: 'repeat-juncture'; index: FormIndex };
```

Consumers `switch (event.kind)` with exhaustiveness; no extra model queries to learn the
event type.

---

## 7. XPath engine — vendored subset of @getodk/xpath (IMPLEMENTED, Phase 2 complete)

Phase 2 implemented the full XPath evaluation stack. The integration strategy changed from
"npm dependency" to **vendored source** during Phase 2 Slice 1, when the team discovered that
`@getodk/common` is a private package (never published to npm) and `@getodk/xpath` depends on
it. Additionally, `ts-rosa` requires internal, non-public exports of `@getodk/xpath`
(`FunctionLibraryCollection`, `fn/javarosa/xforms` function libraries) that are not available
from a dist bundle. Vendoring the minimum TypeScript source subset is the only portable,
publishable approach. Apache-2.0 permits this.

### 7.1 Vendored subset (`src/xpath/vendor/`)

The subset was copied from upstream commit **`c02a421`** (`getodk/web-forms`, branch `main`,
2026-06-23). Provenance and license are recorded in `src/xpath/vendor/VENDOR.md`. Internal
`@getodk/common` and `@getodk/xpath` import specifiers have been rewritten to relative paths;
no external `@getodk/*` imports remain in the vendor tree.

**What was vendored:**

- `vendor/common/` — pure-TS subset of `@getodk/common`: `constants/`, `env/detection`,
  `lib/collections/`, `lib/error/`, `lib/string/`.
- `vendor/xpath/` — the generic `Evaluator<T>`, `XPathDOMAdapter` interfaces, `SyntaxNode`
  types, evaluation result types, and the full function libraries (`fn/`, `javarosa/`,
  `xforms/`).

**What was intentionally excluded:**

| Module | Reason |
|---|---|
| `xpath/expressionParser.ts` (tree-sitter / WASM) | WASM parser — ts-rosa uses its own pure-JS parser |
| `xpath/static/grammar/TreeSitterXPathParser.ts` | Same — WASM dependency |
| `common/lib/dom/compatibility.ts` | Browser globals (`document`, `window`) |
| `common/lib/web-compat/*` | Browser globals (`atob`, `fetch`, etc.) |

**Vendor patches** (`src/xpath/vendor/PATCHES.md`): 8 conformance patches were applied to the
vendor tree to achieve XPath 1.0 / JavaRosa parity. Every deviation from upstream is documented
with the file, change, and the specific JavaRosa test that drove it. A future re-vendor MUST
re-apply all listed patches. Key patches include:
- Patch 1: `string(NaN)` → `"NaN"` (XPath 1.0 §4.2)
- Patch 2: `or`/`and` return `BooleanEvaluation`, not the raw operand (XPath 1.0 §3.4)
- Patch 3: JavaRosa-compatible string-to-number (rejects `Infinity`, scientific notation)
- Patch 4: float equality tolerance `1e-12` (matches JVM double arithmetic)
- Patch 6: `round(-0.5)` → `-0` (XPath 1.0 / JavaRosa behavior)
- Patch 7: `date()` throws `XPathTypeMismatchException` for invalid inputs
- Patch 8: `format-date()` supports time specifiers (`%H`, `%M`, `%S`, `%3`)

**Browser-globals firewall:** an ESLint `no-restricted-imports` rule blocks any re-introduction
of the excluded browser-global paths. Must be re-audited on every re-vendor.

### 7.2 Component layout and data flow

```
src/xpath/
  index.ts               Public seam barrel — exports evaluateXPath, evaluateXPathTyped,
                         compileXPath, CompiledExpression, EvaluationContext, XPathValue
  seam/
    XPathSeam.ts         ONLY import boundary for XPath within ts-rosa.
                         Exposes evaluateXPath (primitive coercion), evaluateXPathTyped
                         (discriminated union), and compileXPath / CompiledExpression
                         (parse-once / eval-many — Phase 3 DataBinding handoff).
  evaluator/
    XmldomEvaluator.ts   Subclass / instantiation of vendored Evaluator<XmldomNode>.
                         Injects PureJSExpressionParser + XmldomXPathAdapter +
                         FunctionLibraryCollection (fn + javarosa + xforms).
                         Does NOT import expressionParser.ts (WASM); zero WASM dep.
  adapter/
    XmldomXPathAdapter.ts  XPathDOMAdapter<XmldomNode> over @xmldom/xmldom — 20 methods
                           covering node kind, name, value, tree traversal, document order.
                           Replaces the default WHATWG adapter (requires browser globals).
    XmldomNode.ts        Type alias for the xmldom Node union used across the adapter.
    kind.ts              Node-kind helpers.
    traversal.ts         Tree traversal utilities.
    names.ts             Namespace/local-name helpers.
    values.ts            Node-value extraction.
  parser/
    PureJSExpressionParser.ts  Recursive-descent + precedence-climbing XPath 1.0 parser.
                               Emits SyntaxNode trees structurally identical to the
                               tree-sitter-xpath grammar (.type vocabulary, child ordering,
                               wrapper nodes). Backed by a simple LRU cache.
    SyntaxNode.ts        ts-rosa's own SyntaxNode / ASyntaxNode / ParsedTree types,
                         structurally compatible with the vendored SyntaxNode interface.
    Tokenizer.ts         Lexer: tokenizes XPath 1.0 expression strings → Token[].
  functions/
    index.ts             Constructs the FunctionLibraryCollection for the evaluator:
                         XPath 1.0 + ODK/jr: + xforms functions. Circular-dependency
                         modules (javarosa/node-set, xforms/node-set) excluded pending
                         Slice 4 / Phase 3 NodeSet support.
  vendor/                Vendored source (see §7.1 above).
    VENDOR.md            Provenance: repo, upstream commit c02a421, license Apache-2.0.
    PATCHES.md           All 8 patches with file, change, and JavaRosa test reference.
    common/              Subset of @getodk/common (pure-TS only).
    xpath/               Subset of @getodk/xpath (evaluator, functions, types).
```

**Data flow:**

```
caller
  └─► evaluateXPath(expr, context?)  [seam/XPathSeam.ts — only public entry]
        │
        ▼
  XmldomEvaluator.evaluate(expr, contextNode)  [vendored Evaluator<XmldomNode>]
        │
        ├─► PureJSExpressionParser.init(expr)  [tokenize → recursive-descent → SyntaxNode tree]
        │         (cached via LRU; same vocabulary as tree-sitter-xpath)
        │
        ├─► XmldomXPathAdapter  [20-method bridge over @xmldom/xmldom]
        │
        └─► FunctionLibraryCollection  [XPath 1.0 + ODK/jr: + xforms]
              │
              ▼
        XPathEvaluationResult  [coerced to number | string | boolean | XmldomNode[]]
```

### 7.3 Public seam (`src/xpath/index.ts`)

The seam exposes three functions and their types:

```ts
// Primitive coercion — primary entry point for equivalence tests
evaluateXPath(expr: string, context?: EvaluationContext)
  → number | string | boolean | readonly XmldomNode[]

// Typed discriminated union — for callers that need type dispatch
evaluateXPathTyped(expr: string, context?: EvaluationContext)
  → XPathValue  // { type: 'BOOLEAN'|'NUMBER'|'STRING'|'NODESET'; value/nodes }

// Parse-once / eval-many — Phase 3 DataBinding handoff
compileXPath(expr: string) → CompiledExpression
  // validates at compile time; compiled.evaluate(context?) re-evaluates cheaply
```

`EvaluationContext` carries `instance` (primary instance document), `contextNode`, and an
optional `secondaryInstances` map. When no context is provided, a minimal stub document is used
so the vendored evaluator always receives a valid DOM context node.

### 7.4 Parser strategy — pure-JS, write-own (RESOLVED)

**Decision: bespoke recursive-descent + precedence-climbing parser, written from scratch.**
(The Phase 2 pre-design open question — write-own vs. adapt an existing library — is closed.)

`PureJSExpressionParser` implements a two-stage pipeline:
1. **Tokenizer** (`Tokenizer.ts`): tokenizes XPath 1.0 expression strings into a `Token[]`
   array with discriminated `TokenKind`.
2. **Parser** (`PureJSExpressionParser.ts`): recursive-descent + precedence-climbing,
   emitting `SyntaxNode` trees structurally identical to the tree-sitter-xpath grammar.

The parser is validated against the real tree-sitter-xpath parser via **golden tests**: the
same expressions are parsed by both parsers and the resulting `SyntaxNode` trees are compared
structurally. This ensures the `SyntaxNode` vocabulary (`.type`, `.childCount`, `.children`,
`.child()`, `.text`) remains compatible with all 30+ vendored expression evaluators.

**Why WASM was rejected:** Hermes WASM support arrived in React Native 0.84 (February 2026)
and is not hardened for production. The pure-JS parser eliminates the WASM dependency entirely
and works on every supported RN version.

### 7.5 Phase 2 gate status

- **~223 / 225 `it.fail` XPath tests activated and passing** (GREEN). The two remaining
  deferred tests involve `indexed-repeat` (requires the NodeSet→InstanceTree bridge, Phase 3)
  and `$var` variable references (Phase 3 reactive variable resolution).
- `indexed-repeat` — deferred to Phase 3: requires the NodeSet→InstanceTree bridge.
- `$var` (`VariableReferenceNode`) — deferred to Phase 3: requires DAG variable orchestration.

### 7.6 Known caveats and maintenance notes

- **Vendor patch maintenance:** when re-vendoring from a newer upstream commit, all 8 patches
  in `PATCHES.md` must be re-applied manually. The PATCHES.md file is the authoritative list.
- **Pre-1.0 upstream (`c02a421`):** the vendor is frozen at this commit. The thick
  `XPathSeam` boundary absorbs future upstream breaking changes without touching the rest of
  the engine.
- **Circular-dependency function modules:** `javarosa/node-set.ts` and `xforms/node-set.ts`
  are present in the vendor but excluded from `FunctionLibraryCollection` construction in
  `src/xpath/functions/index.ts` because they import `XFormsXPathEvaluator` circularly.
  They are deferred to Slice 4 / Phase 3 NodeSet support.
- **NodeSet→InstanceTree bridge:** deferred to Phase 3. Phase 2 delivers on-demand XPath
  expression evaluation; the bridge that maps `XmldomNode` NodeSet results to
  `InstanceNode`/`TreeReference` positions in the engine's instance tree is not yet built.
- **`pulldata`** — wired via the vendored function libraries; full integration with secondary
  instances is a Phase 2/6 task.

---

## 8. Immutability of `TreeReference` and `FormIndex`

Both are **immutable value objects** implemented as readonly discriminated-union/record types
with pure transform functions (`contextualize`, `genericize`, `extendRef`, `parentOf`). No
in-place mutation; every navigation/expansion produces a new value. This matches JavaRosa's
value-object intent (§10.1) and is safe to share across sessions and the React adapter.
Equality is by structural comparison (no `QuickTriggerable`-style identity wrappers, §10.2).

---

## 9. Public API surface (`@nuup/ts-rosa`)

Minimal, intent-revealing barrel from `src/index.ts`:

```
parseForm(xml, { xmlParser, clock?, random?, functions?, secondaryInstances? })
                                            -> FormDefinition
createSession(formDefinition, { reactiveFactory? }) -> FormSession  // initial DAG eval
                                            // reactiveFactory: OpaqueReactiveObjectFactory,
                                            // defaults to identity (no reactivity)
answerQuestion(session, index, value)      -> AnswerResult
stepToNext(session) / stepToPrev(session)  -> FormEvent
createRepeat / removeRepeat(session, index)-> FormIndex
getPrompt(session, index)                  -> QuestionView (read-only snapshot)
validate(session)                          -> ValidateOutcome | null
serializeInstance(session, { respectRelevance }) -> string (XML)

// types
FormDefinition, FormSession, FormIndex, FormEvent, AnswerResult,
AnswerValue, TreeReference, XmlParser, Clock, Random, FunctionRegistry,
OpaqueReactiveObjectFactory
```

`XmlParser` (and other platform seams) are REQUIRED inputs — the package ships interfaces and
optional providers under a separate subpath (`@nuup/ts-rosa/platform-node`,
`/platform-rn`, `/platform-browser`) so the core bundle stays clean.

**React/RN** lives OUTSIDE the core, in `adapters/react` (separate entrypoint): a
`useFormSession(formDefinition)` hook subscribes to the session's `FormEvent` stream and
exposes immutable prompt snapshots. The core never imports React.

---

## 10. Phase 0 harness alignment

The harness (proposal `sdd/test-equivalence-harness`) already enforces this architecture:

- `XmlParser` injection seam is the SAME interface the engine will consume — no global
  `DOMParser`. Providers per environment match §2 `platform/`.
- `Scenario` stub surface maps 1:1 to the public API of §9 (`init/answer/next/prev/repeats/
  serialize`), so ported JavaRosa tests become the executable behavior contract.
- `TriggerableDagTest` (ported RED) is the oracle that validates the §4(c) DAG order and
  cascade semantics.
- Harness stays in `tests/`, never `src/` — preserving the "core has no test coupling" rule.

---

## 11. Incremental adoption (mapped to audit §12)

| Phase | Audit items | Modules activated |
|---|---|---|
| 0 (done/in progress) | DSL, Scenario, AnswerResult, harness | `tests/harness`, `platform/XmlParser` |
| 1 Data core | answer types, instance tree, minimal parser | `model/data`, `model/instance`, `parse` (subset) |
| 2 XPath (done) | Vendored `@getodk/xpath` + `@getodk/common` subset at commit `c02a421` (Apache-2.0); 8 conformance patches in `PATCHES.md`. Pure-JS `PureJSExpressionParser` (recursive-descent + precedence-climbing), validated by golden tests. `XmldomXPathAdapter` (~20 methods). `XPathSeam` as sole import boundary (`evaluateXPath`, `evaluateXPathTyped`, `compileXPath`). ~223/225 XPath it.fails GREEN. `indexed-repeat` and `$var` deferred to P3. | `xpath/{vendor,adapter,parser,evaluator,functions,seam,index}` |
| 3 Reactivity | Triggerable + parse-time DAG, relevance/calc/required, constraint, NodeState map, `OpaqueReactiveObjectFactory` seam | `eval/*`, `model/state`, `platform/ReactiveObjectFactory` |
| 4 Navigation/repeats | FormIndex, session events, repeats | `session/*` |
| 5 Dynamic selects + i18n | itemset, itext, secondary instances | `model/def/ItemsetBinding`, `platform/SecondaryInstanceLoader` |
| 6 Serialization + ODK fns | submission XML, ODK functions | `serialize`, `xpath/functions` |
| 7 E2E validation | full validate(), real-form smoke | end-to-end |

Each phase turns a slice of the RED Phase 0 suite GREEN; no phase reaches into a later
module's responsibilities.

---

## 12. Build vs Adopt

Deliberate boundary between what we build and what we reuse from the ODK ecosystem:

| Component | Decision | Rationale |
|---|---|---|
| @getodk/xforms-engine (full) | **Do NOT fork** | Bound to `DOMParser` and Solid; no React Native story. Wholesale adoption would import the exact browser/runtime coupling we are trying to avoid. |
| @getodk/xpath (upstream commit c02a421) | **Vendored subset** (Apache-2.0) | `@getodk/common` is private (never published to npm) and `@getodk/xpath` depends on it. Both packages also expose only internal, non-public exports that `ts-rosa` needs. Vendoring the minimum TypeScript source subset is the only portable, publishable approach. Pruned: WASM parser, browser-global modules. Added: 8 conformance patches (see §7.1). Provenance in `VENDOR.md`; patches in `PATCHES.md`. Generic `Evaluator<T>` + own `XmldomXPathAdapter` + own pure-JS parser + own `XPathSeam` boundary. |
| @getodk/xforms-engine + `packages/scenario` | **Reference only** | Used as a design reference and as an equivalence/behavior cross-check, NOT compiled into ts-rosa. Our own `Scenario` harness (Phase 0) plays the executable-contract role. |
| Reactivity runtime (Solid/Zustand/Jotai/Vue) | **Adopt at the EDGE, not in core** | Core stays runtime-free and mutates plain objects; the client injects an `OpaqueReactiveObjectFactory` (pattern borrowed from @getodk/xforms-engine). |

Net effect: the equivalence core stays portable and dependency-light, we lean on the ODK
ecosystem where it is genuinely reusable (XPath) and as a design oracle (xforms-engine), and
we own the seams (`XPathSeam`, `XmlParser`, `OpaqueReactiveObjectFactory`) that keep upstream
churn from leaking into the engine.

---

## 13. Architectural risks and mitigations

| Risk | Mitigation |
|---|---|
| (c) hybrid drifts from JR DAG order | parse-time DAG topology + cascade order + cycle detection asserted directly by `TriggerableDagTest`, the gate before any Phase 3 merge |
| `@getodk/common` subset pulls browser globals | **MITIGATED (gate: GO).** Only `constants`, `lib/collections`, `lib/error`, `lib/string`, `env/detection` are imported. `lib/dom/compatibility.ts` and `lib/web-compat/*` are forbidden via `no-restricted-imports` ESLint rule. Re-audit on every @getodk/common version bump. |
| WASM (tree-sitter) parser unviable on Hermes | **MITIGATED (Phase 2).** Pure-JS `PureJSExpressionParser` (recursive-descent + precedence-climbing) implemented and validated via golden tests against the real tree-sitter-xpath parser. Zero WASM dependency. Works on all RN versions. |
| `@getodk/xpath` pre-1.0 drift / upstream breaking changes | **MITIGATED.** Source vendored at commit `c02a421`; frozen. `XPathSeam` is the only import boundary; upstream changes require only a targeted re-vendor + re-apply of `PATCHES.md`. Ported `XPathEvalTest`/`XPathFuncExprTest` (225+ it.fails) remains the sole equivalence oracle. |
| Vendor patch drift — re-vendor loses conformance fixes | `PATCHES.md` documents all 8 patches with file, change, and the JavaRosa test that drove each. Re-vendor procedure: copy source, rewrite imports, re-apply patches, update commit in `VENDOR.md`. |
| `@getodk/xpath` missing `$var` / `VariableReferenceNode` | Scoped to Phase 3 (DAG orchestration). Phase 2 = on-demand expression evaluation only; `$var` deferred. |
| Default WHATWG adapter requires browser globals | **MITIGATED (Phase 2).** Replaced by `XmldomXPathAdapter` (~20 methods) over `@xmldom/xmldom`, consistent with the `XmlParser` seam. NodeSet→InstanceTree bridge deferred to Phase 3. |
| NodeSet→InstanceTree bridge | Phase 3 work. `XmldomNode` NodeSet results from the XPath engine need to be mapped back to `InstanceNode`/`TreeReference` positions for reactive evaluation. Phase 2 delivers expression evaluation only. |
| XPath coercion / `1e-12` / `position()` / `current()` subtleties | 225+ it.fails as equivalence suite, green from Phase 2 day 1. Coercion parity validated by ported test suite. |
| `@xmldom/xmldom` unviable on Hermes | Phase 0 RN smoke test gates before building on top; `XmlParser` interface lets us swap providers |
| Discriminated-union refactor diverges from class-based JR semantics | Behavior covered by ported tests, not structure; unions reviewed against audit §3 |
| Client reactive factory misuse (e.g. returning a non-equivalent object) | `OpaqueReactiveObjectFactory` contract requires structural identity; core default is identity; document edge adapters (Solid/Zustand) |
| Date/timezone semantics (JS `Date`) | `Clock` seam + fixed-date tests; dedicated `XDate` XPath value type |
| Scope creep (SMS, jr://, binary persistence) | Explicitly out of default scope (audit §12 note); caller passes resolved secondary data |

## Open questions

- [x] Reactivity model — CONFIRMED: option (c) Hybrid, with parse-time DAG + separate
      NodeState + injected `OpaqueReactiveObjectFactory` (see §4).
- [x] XPath integration strategy — RESOLVED (Phase 2): **vendored source** (not npm dep).
      `@getodk/common` is private; internal exports required. Vendored at commit `c02a421`
      under `src/xpath/vendor/` (Apache-2.0). See §7.1.
- [x] `@getodk/common` browser-globals audit — GATE: GO. Permitted subset vendored;
      forbidden paths (`lib/dom/compatibility.ts`, `lib/web-compat/*`) excluded from vendor
      and blocked via ESLint `no-restricted-imports` rule.
- [x] WASM / tree-sitter parser for Hermes — REJECTED. Pure-JS parser implemented (see §7.4).
      Hermes WASM (RN 0.84, Feb 2026) not hardened; pure-JS portable across all RN versions.
- [x] **Pure-JS parser: write bespoke vs. adapt existing library — RESOLVED (Phase 2).**
      Bespoke `PureJSExpressionParser` (recursive-descent + precedence-climbing) written from
      scratch. Validated via golden tests against real tree-sitter-xpath parser. See §7.4.
- [ ] NodeSet→InstanceTree bridge — Phase 3. Maps `XmldomNode` NodeSet results to
      `InstanceNode`/`TreeReference` for reactive evaluation. Blocks `indexed-repeat` and 2
      remaining XPath tests.
- [ ] XPath `$var` (`VariableReferenceNode`) — Phase 3 (DAG + reactivity variable resolution).
- [ ] `pulldata` full wiring — vendored function library present; integration with secondary
      instances deferred to Phase 2/6.
- [ ] Whether `FormDefinition` reuse across multiple concurrent sessions is a real product
      requirement (affects how strictly definition stays immutable).
