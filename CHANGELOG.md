# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
