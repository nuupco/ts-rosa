# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
