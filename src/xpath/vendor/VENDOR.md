# Vendored code — @getodk/xpath + @getodk/common (subset)

## Origin

- **Repository**: https://github.com/getodk/web-forms
- **Packages**: `packages/xpath` and `packages/common`
- **Upstream commit**: `c02a421` (branch: `main`, as of 2026-06-23)
- **License**: Apache-2.0
- **Copyright**: Copyright 2023-2024 ODK / Get ODK Inc.

## Why vendored

`@getodk/common` is a private package (never published to npm). `@getodk/xpath`
depends on it, so neither can be installed from the npm registry. Additionally,
`ts-rosa` requires access to internal, non-public exports of `@getodk/xpath`
(e.g. `FunctionLibraryCollection`, `fn/javarosa/xforms` function libraries).
Vendoring the minimum TypeScript source subset is the only portable, publishable
approach. Apache-2.0 permits this.

## Structure

```
vendor/
  common/          — subset of packages/common/src
    constants/     — xmlns, datetime constants
    env/           — runtime detection (no browser globals)
    lib/
      collections/ — pure collection utilities
      error/       — error helpers
      string/      — string utilities
  xpath/           — subset of packages/xpath/src
    adapter/       — XPathDOMAdapter interfaces and xpathDOMProvider
    context/       — Context and EvaluationContext
    error/         — JR-compatible error types
    evaluations/   — Evaluation result types
    evaluator/     — Evaluator, functions, steps, axes
    functions/     — built-in XPath and ODK/XForms function libraries
    global-types/  — ambient type declarations (no browser globals in runtime)
    home/          — entry points / re-exports
    static/        — grammar / SyntaxNode types
    xforms/        — XFormsXPathEvaluator and related interfaces
```

## What was pruned

The following modules from upstream were intentionally **excluded**:

| Module | Reason |
|---|---|
| `xpath/src/expressionParser.ts` (tree-sitter / WASM) | WASM parser — `ts-rosa` uses its own pure-TS parser |
| `xpath/src/static/grammar/TreeSitterXPathParser.ts` | Same — WASM dependency |
| `common/src/lib/dom/compatibility.ts` | Browser globals (`document`, `window`) |
| `common/src/lib/web-compat/` | Browser globals (`atob`, `fetch`, etc.) |

The `base64Decode` function in `xpath/functions/xforms/string.ts` was adapted
to use `crypto-js` (already a direct dependency of that module) instead of the
excluded `@getodk/common/src/lib/web-compat/base64.ts`.

## Internal imports

All `@getodk/common` and `@getodk/xpath` import specifiers within this vendor
tree have been rewritten to relative paths. No external `@getodk/*` imports
remain.

## Maintenance

**Do not edit these files manually.**
To update from upstream: re-copy the relevant source files from
`getodk/web-forms` at the desired commit, re-apply the import rewrites and
browser-global exclusions described above, and update the commit reference in
this file.
