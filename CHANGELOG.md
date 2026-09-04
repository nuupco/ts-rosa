# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-09-03

### Added
- `SelectChoice.geometry`: dynamic itemsets can now declare a `<geometry ref="..."/>` column, exposed per choice as a raw `"lat lon [alt [acc]]"` string (geopoint-nodeset convention). Enables consumers to implement `selectOne`/`select1` `appearance="map"`.

## [0.3.0] - 2026-08-31

### Added
- `FormSession.finalize()`: a new pre-submission lifecycle hook. Call it once, right before `serializeToXml()`, when the form is actually being submitted. Mirrors JavaRosa's `FormDef#postProcessInstance`.
- `<setvalue event="xforms-revalidate">` is now supported — fires from `FormSession.finalize()`, in declaration order. Previously rejected by the parser as an unsupported event token.

### Fixed
- `jr:preload="timestamp" jr:preloadParams="end"` previously never resolved to form-close time — it always mirrored form-open time (same as `preloadParams="start"`) because nothing re-invoked preload resolution before submission. `FormSession.finalize()` now re-resolves it and re-runs the calculate cascade for any dependents.

## [0.2.0] - 2026-08-24

### Added
- `rank` questions now validate that the answer is exactly a permutation of the itemset choices (no duplicates, missing, or foreign tokens), reported via a new `AnswerResult.RANK_INVALID` / `ValidateOutcome.status` value. Scoped to `rank` only — `select`/`select1` remain unvalidated for itemset membership, unchanged.
- `<setvalue>` now accepts multiple space-separated `event` tokens on one element (one action fires per token), and supports `odk-new-repeat` and `jr-insert` (JavaRosa's deprecated non-namespaced repeat-insert token, model-level only) — both fire from repeat-instance creation, before the DAG cascade.
- `<setvalue>` target refs are now resolved at fire time through the XPath seam instead of parse-time string matching, so repeat-relative targets (`..`, `[position()=1]`) and `$var`-rooted targets now work.

### Changed
- **Breaking**: an unresolvable or ambiguous `<setvalue>` target (zero or more than one matching node) now throws instead of silently doing nothing.
- **Breaking**: `parseAbsoluteRef` now throws on a non-numeric ref predicate (e.g. `[position()=1]`) instead of silently resolving it to `INDEX_UNBOUND`.

### Fixed
- README/API.md/architecture docs incorrectly described `jr://file/*.xml` and `jr://instance/last-saved` external secondary instances, and the XPath `indexed-repeat`/`$var` support, as unimplemented — both had already shipped. Docs corrected to match actual behavior.

## [0.1.11] - 2026-08-19

### Fixed
- `buildInstanceNode`'s same-name counter (and `appendChild`'s) counted a `jr:template` sibling toward the running multiplicity total, so the first real repeat instance loaded next to its template — e.g. a resumed/edited submission with an already-answered repeat instance — got multiplicity 1 instead of 0. `resolveReference`/`resolveAll` were unaffected (they recompute position by filtering out templates), but the `position(nodeset)` XPath extension's fast path trusts the stored multiplicity directly, so any `position(..)`-relative calculate silently read the wrong list item for every pre-loaded repeat instance (#2 — root cause of the reported "razon_actual resolves to the wrong value on a pre-existing repeat instance" symptom).

## [0.1.10] - 2026-08-19

### Fixed
- `applyRecalculateGrouped` (used by `initializeRepeatInstance` for triggerables whose triggers are fully outside the new repeat subtree) unconditionally grouped target nodes by grandparent and broadcast one evaluated value to every node in the group — safe only for context-independent expressions, unlike its twin `applyRecalculate`, which already guards this. A position()/`..`-relative calculate could have one repeat instance's value silently copied onto every other same-grandparent instance instead of being evaluated in its own context (#2). Added regression coverage for the reported pattern (an outside select-multi distributed across `jr:count`-driven repeat instances via `selected-at(x, position(..)-1)`).

## [0.1.9] - 2026-08-19

### Fixed
- `pulldata()` built a fresh XPath expression string and re-parsed + linearly re-scanned the CSV secondary instance's rows on every single call — cascades of 3+ `pulldata()` calls off one answer caused multi-second UI freezes (#1). Lookups now use a lazily-built, per-(secondary-instance, lookup-column) index (`Map<lookupValue, item>`), cached by the instance's root node, turning repeated lookups into O(1). Falls back to the original XPath path for non-CSV (inline XML) secondary instances, whose shape isn't guaranteed flat. Also escapes single quotes when interpolating values into the fallback XPath expression, closing a correctness/injection gap.

## [0.1.8] - 2026-08-18

### Fixed
- `jr:choice-name()` threw `"...which has no possible choices"` for every well-formed form that used it (static choices or itemset alike) — the `XPathChoiceNode` interface it depends on was never implemented by any node type. `InstanceElementNode` now implements `getChoiceName()`, reusing `getChoices()` entirely (same cache, same static/itemset branching, same itext resolution). A node with no matching question or choice now resolves to `''` (fail-soft) instead of throwing.

## [0.1.7] - 2026-08-17

### Changed
- `resolveReference`/`resolveAll`/`resolveAllWithin`/`resolveAllContextualized` now find same-name non-template children in a single pass with early exit, instead of two chained `.filter()` scans per reference level. Measured in isolation: resolving every instance in a 4,000-sibling set once, 397ms → 130ms (~3x).
- `triggerTriggerables()` sorts the (small) set of triggerables to re-evaluate by a precomputed topological index, instead of scanning the full triggerable list on every `answerQuestion()` call. No measurable difference at plausible form sizes (evaluating each triggerable's expression dominates), but strictly smaller asymptotic cost with zero behavior change.

## [0.1.6] - 2026-08-17

### Fixed
- `buildInstanceNode()` built same-name element children via `appendChild()`, which recomputes multiplicity by scanning all of the parent's existing same-name children on every call — O(n) per child, O(n²) overall. This hit any large *inline* (non-CSV) secondary instance, e.g. a lookup table pasted directly into the XForm's `<instance>` block. Fixed with a running per-name counter, same fix shape as the CSV case in 0.1.2. Measured: a 20,000-item inline secondary instance parsed in ~9,952ms → ~269ms (~37x).

## [0.1.5] - 2026-08-17

### Changed
- `getChoices()` now recognizes the classic cascading-select `choice_filter` shape (`instance('id')/path/item[column = ref]`, either operand order) and indexes candidate items by the filtered column's value once, instead of rescanning the whole secondary instance on every distinct filter value — the same approach JavaRosa uses (`EqualityExpressionIndexFilterStrategy`). Any other predicate shape (compound conditions, functions, nested brackets) falls back to the existing generic evaluator unchanged. Measured on the real 296,124-row production CSV: first evaluation ~231ms (builds the index), every subsequent distinct filter value ~46-62ms — down from ~2,400-5,100ms per evaluation.

## [0.1.4] - 2026-08-17

### Changed
- Filtering a large secondary instance by a single-select `choice_filter` (e.g. `instance('locs')/root/item[id_municipio = 'X']`) is now significantly faster. Two per-node computations in the vendored XPath evaluator (`NodeEvaluation.computeValues()` and `LocationPathEvaluation.nodeEvaluations`) that were eagerly computed together are now lazily computed and cached independently, since most comparisons (including this one) only ever need one of them. Measured on a real 296,124-row production CSV: ~2985ms → ~1710-1900ms (-36% to -43%).

## [0.1.3] - 2026-08-17

### Added
- `getAttribute`, `setAttribute`, `deleteAttribute`, `attributeNames` — public helpers for `InstanceNode.attributes`, now lazily allocated instead of an eagerly-created `Map` on every node.

### Changed
- `csvToInstanceTree()` casts each cell straight to its `AnswerValue` instead of round-tripping through `node.attributes` + `applyBindings`. Measured on a real 296,124-row/3-column production CSV (8.0MB): RSS delta 909MB → 559MB (-38%), build time 859ms → 399ms (-54%).

## [0.1.2] - 2026-08-17

### Fixed
- `csvToInstanceTree()` built each CSV row's `item` node via `appendChild(root, item)`, which recomputes multiplicity by scanning all of `root`'s existing same-name children on every call — O(n) per row, O(n²) overall. A 100,000-row `jr://file-csv/*` secondary instance took ~84s to build (measured), surfacing as an indefinite "loading form" hang in consuming apps. Fixed by assigning multiplicity directly since rows are appended strictly in order: ~84s → ~176ms for 100k rows.

## [0.1.1] - 2026-08-17

### Fixed
- `FormEvaluator.getChoices()` returned an empty array for every `select`/`select1` `<itemset>` nested inside a `<repeat>`, in every repeat instance. `findQuestionByRef()` compared the runtime ref (concrete multiplicity) against the body-tree definition ref (template multiplicity) with an exact string match, which never matched under a repeat. Fixed by genericizing the runtime ref before comparing.

## [0.1.0] - 2026-08-16

First versioned release. Summarizes the state of the package rather than its full commit history.

### Added
- XForms parser (`parseForm`, `parseDocument`): body/model parsing, itext, itemsets, repeats, `setvalue` actions, XLSForm `rank` question type.
- Form session runtime: `createFormSession`, `FormNavigator`, `FormEvaluator`, DAG-based recomputation, validation, and XML serialization.
- Instance hydration for editing existing submissions (`hydrateInstance`, `HydrationError`).
- External secondary instances (e.g. `jr://file-csv/*.csv`) via `registerExternalInstanceResolver` / `getExternalInstanceResolver` and `resolveExternalInstances`.
- Platform seams: `registerXmlParser` / `getXmlParser`.
- Public API surface contract test freezing the runtime exports and load-bearing types of `src/index.ts`.

### Changed
- Package version moves from the placeholder `0.0.0` to `0.1.0`.
