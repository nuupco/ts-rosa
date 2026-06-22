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
  xpath/                    XPath engine = ADAPTATION LAYER over forked @getodk/xpath
    XPathSeam.ts            ts-rosa's own XPath interface; engine depends ONLY on this
    evaluator.ts            wraps @getodk/xpath generic `Evaluator` (NOT XFormsXPathEvaluator)
    DomAdapter.ts           XPathDOMAdapter<T> over @xmldom/xmldom (replaces WHATWG adapter
                            that requires browser globals — the blocker we remove)
    functions/              FunctionLibraryCollection: xpath1.0 + ODK/jr + pulldata
                            (client extensions registered without touching core)
    value.ts                XPathValue = Boolean|Number|String|XDate|NodeSet (seam-level union)
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

## 7. XPath engine — fork and adapt @getodk/xpath (CONFIRMED)

We do NOT hand-write a lexer/parser. We **fork and adapt @getodk/xpath** (Apache-2.0, v0.11),
ODK's own XPath 1.0 + ODK-extensions engine, and put it behind a ts-rosa seam. This avoids
reimplementing the well-tested XPath grammar, coercions and ODK/`jr:` functions while keeping
our core portable.

```
EvaluationContext --> xpath/XPathSeam (ts-rosa interface, engine depends ONLY on this)
                            |
                            v
              xpath/evaluator.ts  wraps @getodk/xpath generic `Evaluator`
                            |        + FunctionLibraryCollection (ODK/jr fns)
                            v
              xpath/DomAdapter.ts  XPathDOMAdapter<T> over @xmldom/xmldom
                            |
                            v
              XPathValue = Boolean | Number | String | XDate | NodeSet (seam-level union)
```

- **Reuse the GENERIC `Evaluator`** from @getodk/xpath. It accepts an injected
  `XPathDOMAdapter<T>` and a `FunctionLibraryCollection` — it does NOT assume the DOM. This is
  the integration point that makes the fork viable off-browser.
- **Do NOT use `XFormsXPathEvaluator` directly.** That class is wired to browser DOM
  expectations. We wrap the generic `Evaluator` behind ts-rosa's `XPathSeam` so the rest of the
  engine never imports @getodk/xpath types directly — the seam is our stable boundary.
- **Implement our own `XPathDOMAdapter<T>` over @xmldom/xmldom.** @getodk/xpath ships a default
  WHATWG adapter that requires browser globals; that adapter is THE blocker we replace. Our
  adapter binds the generic evaluator to the same `@xmldom/xmldom` node model the rest of the
  engine uses (consistent with the `XmlParser` seam, §2).
- **Functions** are registered through a `FunctionLibraryCollection`: XPath 1.0 + ODK/`jr:`
  functions + client extensions, without touching core (audit §10.1, §11). The `xpath/`
  module is therefore an **adaptation layer + function registry + wrapper behind the seam**,
  not an in-house implementation.
- **`XPathValue`**: strict seam-level union (never `Object`/`any`). Equality coercion priority
  Boolean > Number > String; double comparison tolerance `1e-12` must match JavaRosa exactly —
  verified against the ported `XPathEvalTest`/`XPathFuncExprTest` suites.

### 7.1 Mandatory pre-flight GATE (before committing to the fork)

**Audit the transitive dependency `@getodk/common` BEFORE adopting @getodk/xpath.** It is the
chief risk for pulling in browser globals; if it does, the off-browser/Hermes portability
guarantee breaks. This gate must pass before any Phase 2 integration work proceeds.

### 7.2 Known caveats to track

- **XPath variables (`$var`) are NOT implemented** in @getodk/xpath — track and plan a
  workaround if any target form relies on them.
- **`pulldata` support is unconfirmed** — verify against the upstream function library.
- **No direct comparison tests against JavaRosa exist upstream** — our ported XPath equivalence
  suite is the only oracle; treat it as load-bearing from Phase 2 day 1.
- **Pre-1.0 (v0.11)** — FREEZE the exact version and keep the adaptation layer (`XPathSeam`)
  thick enough to absorb upstream breaking changes.

This decision materializes in **Phase 2**; it does NOT affect Phase 0.

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
| 2 XPath | GATE: audit `@getodk/common`; fork+adapt @getodk/xpath (own `XPathDOMAdapter` over @xmldom/xmldom), wire functions behind `XPathSeam` | `xpath/*` |
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
| @getodk/xpath (v0.11) | **Fork and adapt** (Apache-2.0) | Generic `Evaluator` accepts an injected `XPathDOMAdapter<T>` and is not DOM-bound. We supply our own adapter over `@xmldom/xmldom` and wrap it behind `XPathSeam`. Saves reimplementing a tested XPath 1.0 + ODK grammar. Subject to the §7.1 gate and §7.2 caveats. |
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
| `@getodk/xpath` pulls browser globals via transitive `@getodk/common` | MANDATORY pre-flight gate: audit `@getodk/common` BEFORE committing to the fork (§7.1); if it brings globals, the off-browser guarantee breaks |
| `@getodk/xpath` missing/incomplete features (`$var` not implemented, `pulldata` unconfirmed) | Track caveats (§7.2); keep `XPathSeam` thick enough to add/override functions; plan workarounds per target form |
| `@getodk/xpath` is pre-1.0 (v0.11) with no upstream JR comparison tests | Freeze the exact version; our ported `XPathEvalTest`/`XPathFuncExprTest` is the sole equivalence oracle; adaptation layer absorbs upstream breaking changes |
| Default WHATWG adapter requires browser globals | Replace with our own `XPathDOMAdapter<T>` over `@xmldom/xmldom`, consistent with the `XmlParser` seam |
| XPath coercion/`1e-12`/position()/current() subtleties | Port `XPathEvalTest`/`XPathFuncExprTest` as equivalence suite from Phase 2 day 1 |
| `@xmldom/xmldom` unviable on Hermes | Phase 0 RN smoke test gates before building on top; `XmlParser` interface lets us swap providers |
| Discriminated-union refactor diverges from class-based JR semantics | Behavior covered by ported tests, not structure; unions reviewed against audit §3 |
| Client reactive factory misuse (e.g. returning a non-equivalent object) | `OpaqueReactiveObjectFactory` contract requires structural identity; core default is identity; document edge adapters (Solid/Zustand) |
| Date/timezone semantics (JS `Date`) | `Clock` seam + fixed-date tests; dedicated `XDate` XPath value type |
| Scope creep (SMS, jr://, binary persistence) | Explicitly out of default scope (audit §12 note); caller passes resolved secondary data |

## Open questions

- [x] Reactivity model — CONFIRMED: option (c) Hybrid, with parse-time DAG + separate
      NodeState + injected `OpaqueReactiveObjectFactory` (see §4).
- [x] XPath engine — CONFIRMED: fork and adapt @getodk/xpath behind `XPathSeam` (see §7).
- [ ] Result of the `@getodk/common` browser-globals audit (§7.1 gate) — pass/fail decides
      whether the @getodk/xpath fork proceeds as-is or needs deeper surgery.
- [ ] Workaround strategy for XPath `$var` (not implemented upstream) if any target form needs it.
- [ ] Confirm `pulldata` is available in the upstream function library or must be added in `xpath/functions`.
- [ ] Whether `FormDefinition` reuse across multiple concurrent sessions is a real product
      requirement (affects how strictly definition stays immutable).
