# Vendor Patches

This file documents every deviation from the upstream @getodk/xpath + @getodk/common
source code vendored in this directory. Each entry includes the file, what changed,
and the JavaRosa/XPath conformance reason. A future re-vendor MUST re-apply all
patches listed here.

Upstream commit: `c02a421` (packages/xpath + packages/common, web-forms main, 2026-06-23)

---

## Patch 1 — NumberEvaluation: NaN stringValue

**File**: `src/xpath/vendor/xpath/evaluations/NumberEvaluation.ts`
**Applied in**: Slice 2b (commit 6d23557)

**Change**: `this.stringValue = Number.isNaN(value) ? '' : String(value)`
→ `this.stringValue = Number.isNaN(value) ? 'NaN' : String(value)`

**Reason**: XPath 1.0 §4.2 / JavaRosa spec: `string(NaN)` must return `"NaN"`,
`string(Infinity)` must return `"Infinity"`, `string(-Infinity)` must return
`"-Infinity"`. Upstream erroneously returned empty string for NaN.

---

## Patch 2 — BooleanBinaryExpressionEvaluator: or/and return BooleanEvaluation

**File**: `src/xpath/vendor/xpath/evaluator/expression/BooleanBinaryExpressionEvaluator.ts`
**Applied in**: Slice 2b (commit 6d23557)

**Change** (and): `if (lhsResult.toBoolean()) return rhs.evaluate(context); return lhsResult`
→ returns `new BooleanEvaluation(context, bool)` in all branches.

**Change** (or): `if (lhsResult.toBoolean()) return lhsResult; return rhs.evaluate(context)`
→ returns `new BooleanEvaluation(context, bool)` in all branches.

**Reason**: XPath 1.0 §3.4: `or` and `and` must return a boolean result, not the
raw operand evaluation. Upstream returned the NumberEvaluation from the short-circuit
operand, causing boolean-typed results to have wrong type.

---

## Patch 3 — StringEvaluation: JavaRosa-compatible string-to-number

**File**: `src/xpath/vendor/xpath/evaluations/StringEvaluation.ts`
**Applied in**: Slice 3

**Change**: Replaced `Number(value)` with `javarosaParseNumber(value)` which uses
`JAVAROSA_NUMBER_RE = /^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/` to reject non-decimal strings.

**Reason**: JavaRosa's `XPathFuncExpr.toNumeric()` only accepts XPath decimal number
literals (digits + optional dot). It rejects `'Infinity'` (→ NaN instead of JS's
`Number('Infinity') = Infinity`) and scientific notation like `'1.1e6'` (→ NaN instead
of `1100000`). JavaRosa tests: `testEval("number('Infinity')", NaN)` and
`testEval("number('1.1e6')", NaN)`.

---

## Patch 4 — ValueEvaluation: float equality tolerance 1e-12

**File**: `src/xpath/vendor/xpath/evaluations/ValueEvaluation.ts`
**Applied in**: Slice 3

**Change**: In `eq()`, when `this.type === 'NUMBER' || operand.type === 'NUMBER'`,
replaced `this.toNumber() === operand.toNumber()` with
`Math.abs(a - b) <= 1e-12` (with explicit NaN short-circuit).

**Reason**: JavaRosa uses `1e-12` absolute tolerance for float equality to handle JVM
double arithmetic imprecision. Example: `6.1 - 7.8 = -1.7` → `true` in JavaRosa
(difference is ~2.2e-16, within 1e-12). XPath 1.0 spec does not define a tolerance,
but JavaRosa deviates to match JVM behavior.
JavaRosa test: `testEval("6.1 - 7.8 = -1.7", TRUE)`.

---

## Patch 5 — xforms/number.ts: type-only import for XFormsXPathEvaluator

**File**: `src/xpath/vendor/xpath/functions/xforms/number.ts`
**Applied in**: Slice 3

**Change**: `import { XFormsXPathEvaluator }` → `import type { XFormsXPathEvaluator }`

**Reason**: The import was only used in a JSDoc `{@link}` reference (a comment). The
value import created a circular module dependency at construction time:
`xforms/number.ts` → `XFormsXPathEvaluator.ts` → `xforms/index.ts` → `xforms/number.ts`.
This caused `FunctionLibrary` to receive `undefined` entries when
`new FunctionLibraryCollection(...)` ran at module evaluation time. Changing to a
type-only import removes the runtime dependency entirely with zero behavior change.

---

## Patch 6 — xforms/number.ts: round() zero-decimals uses Math.round

**File**: `src/xpath/vendor/xpath/functions/xforms/number.ts`
**Applied in**: Slice 3

**Change**: In `xf.round`, added a `if (decimals === 0) return Math.round(value)`
fast path before the unsigned+sign calculation.

**Reason**: The upstream xforms round converts to unsigned and multiplies by sign,
which gives `Math.round(0.5) * -1 = -1` for input `-0.5`. But XPath 1.0 / JavaRosa
`round(-0.5)` must return `-0` (i.e. `Math.round(-0.5) = -0` in V8/Bun). The
unsigned approach breaks this because `Math.round(|−0.5|) = Math.round(0.5) = 1`.
JavaRosa test: `testEval("round('-0.5')", -0.0)`.

---

## Patch 7 — xforms/datetime.ts: date() throws for invalid inputs

**File**: `src/xpath/vendor/xpath/functions/xforms/datetime.ts`
**Applied in**: Slice 3

**Changes**:
1. `case 'BOOLEAN': return new StringEvaluation(context, '')` → throws an Error.
2. `if (unpaddedMatches == null) return new DateTimeLikeEvaluation(context, null)` → throws.
3. `return new DateTimeLikeEvaluation(context, dateTime)` (when `dateTime == null && type !== 'NUMBER'`) → throws.

**Reason**: JavaRosa throws `XPathTypeMismatchException` for:
- Boolean input to `date()` (e.g. `date(true())`).
- Invalid date string (e.g. `date('not a date')`, `date('1983-09-31')`).
Upstream silently returned empty strings or null-valued evaluations. JavaRosa tests:
`testEval("date(true())", new XPathTypeMismatchException())`,
`testEval("date('1983-09-31')", new XPathTypeMismatchException())`.

---

## Patch 8 — xforms/datetime.ts: format-date() uses dateTimeFormatter

**File**: `src/xpath/vendor/xpath/functions/xforms/datetime.ts`
**Applied in**: Slice 3

**Change**: `formatDate` function changed from `dateFormatter(format, dateTime)` to
`dateTimeFormatter(format, dateTime)`.

**Reason**: JavaRosa's `format-date()` supports both date format specifiers (`%Y`,
`%m`, `%e`, `%a`, `%b`) AND time format specifiers (`%H`, `%M`, `%S`, `%3`).
Upstream `formatDate` only used `dateFormatters` (date-only), causing time specifiers
like `%H:%M:%S` to be left as literal text. `dateTimeFormatter` covers the full
set. JavaRosa test: `testEval("format-date('2018-01-02T10:20:30.123', \"%Y-%m-%e %H:%M:%S\")", "2018-01-2 10:20:30")`.

---

## Non-vendor: excluded circular-dependency modules

**Not a vendor patch** — these modules exist in upstream but are excluded from our
`FunctionLibraryCollection` construction in `src/xpath/functions/index.ts`:

- `javarosa/node-set.ts` (`itext` function): imports `XFormsXPathEvaluator.ts` which
  in turn imports `javarosa/index.ts`, creating a circular module graph.
  Also requires `XFormsItextTranslations` infrastructure not present in ts-rosa.

- `xforms/node-set.ts` (`instance`, `count-non-empty`, `randomize`, etc.): same
  circular dependency via `XFormsXPathEvaluator.ts`. DOM-traversal functions require
  Slice 4 nodeset support.

Both were deferred until Phase 5 PREREQ. They are NOT removed from the vendor — only
excluded from the manual `FunctionLibrary` construction in `src/xpath/functions/index.ts`.

## Patch 9 — Step.ts: filter_expr + filter_path_expr cases

**File**: `src/xpath/vendor/xpath/evaluator/step/Step.ts`
**Applied in**: Slice 5b (commit 1361c42)

**Change**: Added two switch cases in the step factory (or equivalent dispatch):
- `filter_expr` → returns `FilterExprContextNodeStep`
- `filter_path_expr` → returns `FilterExprContextNodeStep`

**Reason**: Without these cases, multi-step filter path expressions rooted at a
secondary instance call (e.g. `instance('towns')/towndata/data_set`) were
unrouted and would throw or silently evaluate to an empty node-set. The grammar
nodes `filter_expr` and `filter_path_expr` are only produced when an XPath
expression begins with a filter expression (such as `instance(...)`), so this
change is additive and does not affect standard location path evaluation.

---

## Patch 10 — FilterPathExpressionEvaluator.ts: nested filter_path_expr detection

**File**: `src/xpath/vendor/xpath/evaluator/expression/FilterPathExpressionEvaluator.ts`
**Applied in**: Slice 5b (commit 1361c42)

**Change**: Added nested `filter_path_expr` detection in the constructor
(handling the case where a `FilterPathExprNode`'s first child is itself another
`FilterPathExprNode`). The original else branch (handling a `FilterExprNode`
first child) is unchanged.

**Reason**: When an instance path has more than one step after the filter root
(e.g. `instance('id')/root/child`), the AST may nest `filter_path_expr` nodes.
Without this branch the inner node would be mishandled and evaluation would fail.
The fix is additive: the new branch fires only when the first child grammar type
is `filter_path_expr`; all other cases fall through to the original logic.

---

## Patch 11 — factory.ts: filter_expr passthrough + filter_path_expr fast-path

**File**: `src/xpath/vendor/xpath/evaluator/expression/factory.ts`
**Applied in**: Slice 5b (commit 1361c42)

**Change**:
- Added `filter_expr` as a transparent passthrough case (unwraps to child
  expression) in the expression factory switch.
- Added a `filter_path_expr` single-child fast-path (line 78–85 area): when the
  node has exactly one child it is forwarded directly rather than constructing a
  full `FilterPathExpressionEvaluator`.

**Reason**: The expression factory was not handling these grammar node types,
causing evaluation to fall through to an error or no-op branch. Both additions
are additive switch cases that fire only on AST nodes produced by
secondary-instance / nested-filter XPath expressions. All existing case routing
is unchanged.

---

## Patch 12 — VariableReference ($name) support

**Files**:
- `src/xpath/vendor/xpath/static/grammar/SyntaxNode.ts`
- `src/xpath/vendor/xpath/evaluator/expression/factory.ts`
- `src/xpath/vendor/xpath/error/UnboundVariableError.ts` (new)
- `src/xpath/vendor/xpath/evaluator/expression/VariableReferenceExpressionEvaluator.ts` (new)

**Applied in**: xpath-variable-references change

**Change**:
- Added `VariableReferenceNode` to the `FilterExprNodes`/`AnyExprNode` type
  unions in `SyntaxNode.ts` (purely additive).
- Added a `variable_reference` case to the expression factory switch in
  `factory.ts`, dispatching to a new `VariableReferenceExpressionEvaluator`.
- Added `UnboundVariableError` (extends `JRCompatibleError`) and
  `VariableReferenceExpressionEvaluator`, which resolves `$name` against a
  module-level active-variable slot (`src/xpath/evaluator/VariableScope.ts`,
  outside vendor/) rather than the upstream `EvaluationContext`'s own
  variable-binding mechanism, which is marked broken upstream.

**Reason**: Upstream's own VariableReference handling is non-functional; ts-rosa
implements read-side XPath 1.0 `$name` support independently to avoid
inheriting upstream's broken variable-binding code, while still needing to
route the AST node type and expression-factory dispatch through the vendored
grammar/factory layer. All changes are additive; no existing case routing or
type is altered.

---

## Native shims (Phase 5 PREREQ — commit b1cebc4)

**Files**: `src/xpath/functions/instance-fn.ts`, `src/xpath/functions/itext-fn.ts`

Instead of adapting the vendored circular-dependency modules, ts-rosa registers two native
shim functions that read per-form state directly from the evaluation context's document node
(`context.contextDocument`), which is an `InstanceDocumentNode` carrying `secondaryInstances`
and `itext` fields set per-session. This is the same pattern used by `xforms-indexed-repeat.ts`.

The shims are registered in `src/xpath/functions/index.ts`:
- `instance` → xf (XForms) library
- `itext` → jr (JavaRosa) library

Per-session itext state is wired in Slice 5a: `FormEvaluator` builds an `ItextResolver` from
`ItextTranslations` (parsed by `itextParser.ts`) and attaches it to the document node. Language
switching (`setLanguage`) mutates the resolver's active-language cursor — no DAG cascade needed
since labels are read-derived, not instance values.
