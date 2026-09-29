# Feature: timezone-offset-aware "time" codec

## Objective
Make the XForm `time` data type carry the device's real UTC offset (e.g.
`15:59:00.000-06:00`) instead of always being epoch-UTC-anchored and
serialized with a trailing `Z`, so downstream comparisons/sync/server
processing are correct across Mexico, Honduras, Nicaragua.

## Why
- `formatUtcTime` (`src/model/data/codecs.ts:38-44`) always emits `Z`,
  discarding any offset info.
- `cast("time", ...)` (`codecs.ts:161-170`) parses via native `Date`, which
  collapses any input offset into an epoch-ms value with no memory of it.
- Flagged by a cross-session message from `tlacuache_app`'s TimeWidget team:
  the widget already encodes wall-clock hours/minutes into an epoch-UTC
  `Date` to match this exact contract; the contract needs to become
  timezone-aware, threaded end-to-end (Date construction → codec
  serialization → widget deserialization).
- Related, separately-confirmed bug: `decimal-time()`
  (`src/xpath/vendor/xpath/functions/xforms/datetime.ts:335-368`) and
  `dateTimeFromString` (`src/xpath/vendor/xpath/lib/datetime/coercion.ts:25-35`)
  convert a `Z`/offset time to `context.timeZone` then force-clamp the date
  back to 1970-01-01, which can produce wrong/negative durations across a
  local midnight boundary.

## Product decision (user-confirmed)
Offset source = **the device's own offset** at the moment of input, not
`PlatformConfig.getPlatformTimeZoneId()`. The codec must preserve and
round-trip whatever offset the device/widget provides, not reinterpret it
through a platform-configured zone.

## Scope
- `src/model/data/codecs.ts`: `formatUtcTime` → offset-aware formatter;
  `cast("time", ...)` decode path to retain the parsed offset.
- The date-record / `AnswerValue` shape for `"time"` (and possibly
  `"dateTime"`) needs a place to remember the offset — currently a plain
  `Date`. Locate exact shape before editing (`src/model/data/AnswerValue.ts`,
  not yet read).
- `uncast` call sites (`codecs.ts:~252`) that call `formatUtcTime`.
- Do NOT change `dateTimeFromString`/`decimal-time` clamp-bug fix in this
  feature unless the offset-aware format change requires it to stay
  correct — investigate whether decimal-time consuming an offset-suffixed
  string instead of `Z` sidesteps or still hits the day-rollover clamp bug.
  If it still applies, note it as a follow-up, do not silently expand scope.
- Out of scope: `tlacuache_app`'s `TimeWidget.tsx` and any other repo/session
  (`xform-native-13`) — this session owns only `ts-rosa`. Cross-repo threading
  is the other sessions' responsibility; we only guarantee this repo's codec
  contract.

## Constraints
- TDD strict mode enabled: RED (failing test asserting offset-aware output) →
  GREEN (implementation) → REFACTOR, with real observed evidence, no
  invented results.
- Preserve existing decode behavior for legacy `Z`-suffixed and offset-less
  inputs (backward compatibility for old/legacy stored data).
- Reuse existing `Temporal` patterns already in the codebase
  (`lib/datetime/functions.ts:13`, `localDateTimeString`'s
  `${str}${dateTime.offset}` precedent) rather than inventing new date math.

## Tasks
- [x] T1: Read `src/model/data/AnswerValue.ts` and the "time"/"dateTime"
      date-record shape; confirm exact type change needed to carry an offset.
      Evidence: read `AnswerValue.ts` (plain `Date` value, no offset field),
      `codecs.ts` (`makeDateRecord`, `formatUtcTime`, `cast`/`uncast`),
      `src/xpath/vendor/xpath/lib/datetime/functions.ts` (`localDateTimeString`
      precedent: `${str}${dateTime.offset}`), `src/platform/temporal.ts`.
      Decision: added optional `readonly offset?: string` to the `"time"`
      variant of `AnswerValue` only (dateTime untouched — out of scope).
- [x] T2: Write failing tests (RED) in `tests/equivalence/data/time-data.test.ts`.
      Evidence: `npx vitest run tests/equivalence/data/time-data.test.ts` →
      4 failed / 12 passed (3 new offset round-trip tests failed as expected;
      1 test needed a machine-timezone-independent rewrite, see below).
- [x] T3: Implement offset-aware format/decode in `codecs.ts` (GREEN).
      Added: `parseTrailingOffset`, `formatOffsetTime` (uses
      `Temporal.Instant.fromEpochMilliseconds(...).toZonedDateTimeISO(offset)`,
      same pattern as `localDateTimeString`), `formatTime` dispatcher;
      `makeDateRecord` now takes optional `offset`; `cast("time", ...)` and
      `uncast` case `"time"` updated. Offset source = the raw input string's
      own trailing offset (never `PlatformConfig`), per product decision.
      Evidence: `npx vitest run tests/equivalence/data/time-data.test.ts` →
      16 passed (0 failed) after also updating one pre-existing test
      (`"time with +02:00 offset..."`) whose assertion codified the exact bug
      being fixed (uncast collapsing `+02:00` input to UTC `Z`) — updated with
      an inline note explaining the behavior change is the feature itself.
- [x] T4: Checked `decimal-time`/`dateTimeFromString` consumers.
      Evidence: `npx vitest run tests/equivalence/xpath/functions.test.ts` →
      42 passed, 0 failed. These functions consume `Date`/`context.timeZone`
      directly and don't go through `codecs.ts`'s `cast`/`uncast`, so no
      regression there. See "Follow-up / regression found" below for one
      real regression found elsewhere (out of this task's file scope).
- [x] T5: Full relevant suites run, evidence recorded below.
- [ ] T6: Commit as one work-unit commit on a feature branch (branch first
      if currently on `main`), Conventional Commit message. — left for the
      user per instructions; not run by this session.
- [x] T7: Fixed the ADR-F regression in
      `tests/model/instance/InstanceHydrator.roundtrip.test.ts` (see
      "Follow-up / regression found" below for original finding). Updated
      the test to assert the offset is now preserved (`+02:00` stays
      `+02:00`, not collapsed to `Z`), with inline comments explaining the
      contract change is a deliberate, confirmed product decision (device
      offset, not PlatformConfig). No standalone ADR-F doc file exists in
      the repo (confirmed via repo-wide `ADR-F` search); the only ADR-F
      references are this test file's own header/describe-block comments
      and this task file, so only the test file's docstring/describe-block
      text was updated alongside the assertion — no separate design doc to
      touch. File touched:
      `tests/model/instance/InstanceHydrator.roundtrip.test.ts`.
      Evidence: `npx vitest run tests/model/instance/InstanceHydrator.roundtrip.test.ts`
      → 11 passed, 0 failed. Full suite `npx vitest run` → 121 passed / 1
      failed (`tests/equivalence/forms/lecturas-de-riego-calculations.test.ts`,
      pre-existing/unrelated, being handled by a separate concurrent agent
      per task instructions — not touched here) / 2 skipped, 1441 total.

## Test evidence (final)
- `npx vitest run tests/equivalence/data/time-data.test.ts tests/model/data/codecs.test.ts tests/model/data/defensive-date.test.ts`
  → 3 files, 56 tests, all passed.
- `npx vitest run tests/equivalence/xpath/functions.test.ts` → 42 tests, all passed.
- `npx vitest run` (full suite) → 120 files passed, 1 file failed
  (`tests/model/instance/InstanceHydrator.roundtrip.test.ts`), 1437 passed /
  1 failed / 2 skipped.

## Follow-up / regression found (out of scope, not fixed)
`tests/model/instance/InstanceHydrator.roundtrip.test.ts` — test
"round-trips a non-UTC-offset time as the semantically equal UTC-normalized
instant" explicitly asserts (per ADR-F, documented in that file's header)
that a `+02:00`-offset time input normalizes to `Z` on round-trip through
`hydrateInstance`/`serializeInstance`, and asserts the output is NOT the
lexically-preserved offset string. This assertion directly encodes the old
lossy-Z behavior this feature intentionally changes, so it now fails
(`InstanceHydrator`/`InstanceSerializer` go through `codecs.ts`'s
`cast`/`uncast`, which now preserves the device offset).
This file is outside the task's authorized scope
(`src/model/data/`, `tests/equivalence/data/`, `tests/model/data/` only), so
it was deliberately left unfixed and unmodified, per task instruction #6.
Needs a follow-up decision: either update that ADR-F test's semantics/assertion
to match the new offset-preserving contract, or scope a separate task for it.

## Delivery
- Delivery strategy: ask-on-risk (default). Forecast: likely under ~400
  changed lines (codec + tests) — single PR/commit expected, reassess if
  AnswerValue shape change ripples further.

## Status
Created 2026-09-29. T1-T5 done, GREEN, evidence recorded above. T6 (commit)
left for the user. One out-of-scope regression found and reported, not fixed
(see "Follow-up / regression found").

---

# Part 2: `decimal-time()` rejects Z/offset-suffixed time strings (NaN bug)

## Objective
Fix `decimal-time()` so a time value with a trailing `Z` or numeric UTC
offset (now the normal serialized form after Part 1) evaluates to a correct
decimal-day fraction instead of `NaN`, and so `duracion_riego`,
`volumen_aplicado`, `lamina_aplicada` compute correctly end-to-end against
the real "Lecturas de Riego" form.

## Why
Confirmed via a real regression test built from the actual production XForm
(`tests/fixtures/forms/lecturas-de-riego.xml`,
`tests/equivalence/forms/lecturas-de-riego-calculations.test.ts`, currently
RED): `isValidTimeString('18:44:00.000Z')`
(`src/xpath/vendor/xpath/lib/datetime/predicates.ts`) returns `false`
because `Temporal.PlainTime.from(...)` throws on any trailing `Z`/offset
designator (`PlainTime` is offset-less by spec). `decimal-time()`
(`src/xpath/vendor/xpath/functions/xforms/datetime.ts:335-368`) short-
circuits to `NaN` as soon as that validation fails, poisoning every
downstream calculate that depends on it
(`duracion_riego_1` → `duracion_riego` → `volumen_aplicado` →
`lamina_aplicada`, all become `"NaN"`).

This is distinct from, but related to, the previously-confirmed
convert-then-clamp day-boundary bug in `dateTimeFromString`
(`src/xpath/vendor/xpath/lib/datetime/coercion.ts:25-35`) — that bug
produces a *wrong* number when a Z/offset time crosses local midnight; this
bug produces *no number at all* for any Z/offset time, regardless of
midnight-crossing, because validation rejects it before conversion is ever
attempted.

## Product/engine decision
`decimal-time()` must accept a time string with `Z` or a numeric offset
(the normal shape now that Part 1 preserves device offsets) and return the
correct decimal-day fraction, consistent with the already-fixed Part 1
contract. Do not special-case this only for the specific values in the
regression test — fix the general validation/parsing so any valid
Z/offset-suffixed or offset-less time string works.

## Scope
- `src/xpath/vendor/xpath/lib/datetime/predicates.ts`: `isValidTimeString`
  (or equivalent) must accept Z/offset-suffixed time strings, not just
  offset-less ones.
- `src/xpath/vendor/xpath/functions/xforms/datetime.ts`: `decimal-time()` —
  verify its parsing path once validation is fixed; check whether it still
  needs the previously-flagged convert-then-clamp day-boundary fix from
  `dateTimeFromString` once Z/offset values actually reach it (do not
  silently skip that check — confirm with a same-day and a midnight-
  crossing test case).
- Existing RED test to turn GREEN:
  `tests/equivalence/forms/lecturas-de-riego-calculations.test.ts`
  (expects `duracion_riego_1='2.02'`, `duracion_riego='2.02'`,
  `volumen_aplicado='7.272'`, `lamina_aplicada='0.0029088'` — verify the
  engine actually produces these once fixed; if formatting differs,
  investigate and report before changing the assertion).
- Do NOT touch `src/model/data/codecs.ts`, `AnswerValue.ts`, or their tests
  — that work (Part 1) is done and merged into this same branch already.

## Constraints
- TDD strict mode: the existing RED test above is the starting RED state —
  confirm it's still red, implement, confirm GREEN, run full suite.
- Add unit-level tests for `isValidTimeString`/`decimal-time()` directly
  (not just the end-to-end form test) covering: offset-less time (legacy,
  must keep working), `Z`-suffixed time, positive-offset time, negative-
  offset time, and a midnight-crossing case for the day-boundary clamp
  question above.
- Full suite must be 0 failures when done.

## Tasks
- [x] T1: Confirmed RED. `npx vitest run tests/equivalence/forms/lecturas-de-riego-calculations.test.ts`
      → 1 failed: `Expected string answer "2.02", but received "NaN"`.
      Root cause confirmed as diagnosed: `isValidTimeString('18:44:00.000Z')`
      threw inside `Temporal.PlainTime.from(...)` (PlainTime is offset-less
      by spec and rejects any trailing `Z`), so `isValidTimeString` returned
      `false` and `decimal-time()` short-circuited to `NaN`.
- [x] T2: Added `tests/unit/xpath/decimal-time.test.ts` — direct unit tests
      for `isValidTimeString()` and `decimal-time()` (offset-less/legacy,
      Z-suffixed, `+02:00`, `-06:00`, an out-of-range offset, garbage input,
      and a midnight-crossing case). RED confirmed by temporarily reverting
      the predicates.ts fix (`git stash`) and re-running: 3 of 14 failed
      (`accepts a Z-suffixed time`, `rejects an out-of-range offset`,
      `computes a Z-suffixed time...`) — the other offset cases already
      passed pre-fix because `Temporal.PlainTime.from` silently ignores (but
      doesn't validate the range of) a *numeric* offset; only `Z` throws.
      Then `git stash pop` restored the fix and all 14 passed (GREEN).
- [x] T3: Fixed `isValidTimeString` in
      `src/xpath/vendor/xpath/lib/datetime/predicates.ts`: strips a trailing
      `Z` or numeric offset (validating the offset's range via the existing
      `VALID_OFFSET_VALUE`/`TIMEZONE_OFFSET_PATTERN` constants — the same
      ones `dateTimeFromString` already uses) before delegating the bare
      time-of-day part to `Temporal.PlainTime.from`, which still rejects
      e.g. `24:00:00` or `06:60:00`. No change needed to `decimal-time()`
      itself — once validation passes, its existing
      `dateTimeFromString`/clamp-to-1970-01-01 path already computes
      correctly (see T4 note on the clamp bug).
- [x] T4: `tests/equivalence/forms/lecturas-de-riego-calculations.test.ts`
      now passes `duracion_riego_1='2.02'`, `duracion_riego='2.02'`,
      `volumen_aplicado='7.272'` (all real computed values, matching the
      hand-derived expectations). The 4th assertion,
      `lamina_aplicada='0.0029088'`, still fails — investigated: the actual
      computed value is `0.0029088000000000004`, which is plain JS
      floating-point behavior (`7.272/25*0.01` in Node gives exactly this,
      confirmed independently). This is a pre-existing number-to-string
      formatting characteristic of the XPath engine's numeric division/
      multiplication → string pipeline, unrelated to `decimal-time()` or
      `isValidTimeString` (no time value flows into this specific
      computation) and out of Part 2's authorized scope
      (`predicates.ts`/`datetime.ts` `decimal-time()` only). Not fixed here,
      per instruction to investigate and report rather than guess at an
      out-of-scope fix or alter the assertion.
      **Clamp-bug question (explicitly checked, per task instructions):**
      the midnight-crossing unit test
      (`decimal-time("23:30:00.000-06:00")` in a UTC evaluation context)
      confirms `decimal-time()`'s "convert to context.timeZone, then reset
      the date to 1970-01-01" step is NOT a bug. `decimal-time()` is a
      time-of-day fraction, matching JavaRosa's
      `DateUtils.decimalTimeOfLocalDay` (`v - Math.floor(v)` after
      converting to the local zone) — both approaches discard the date and
      keep only the resulting wall-clock hour/minute/second, so crossing
      midnight during the offset→context.timeZone conversion does not
      corrupt the result. Hand-derived expected value (23:30-06:00 → 05:30
      next day UTC → 19800/86400 = 0.229166...) matched the observed GREEN
      result exactly. No fix needed; the previously-flagged bug does not
      reproduce once Z/offset values actually reach this conversion path.
- [x] T5: Full suite: `npx vitest run` → 122 files passed, 1 file failed
      (`tests/equivalence/forms/lecturas-de-riego-calculations.test.ts`,
      the `lamina_aplicada` float-formatting assertion from T4 — real,
      pre-existing, out of scope), 1452 passed / 1 failed / 2 skipped
      (1455 total). Every other previously-passing test remains green,
      including all of Part 1's suites and the new
      `tests/unit/xpath/decimal-time.test.ts` (14/14).
- [x] T6: This doc updated with evidence. Commit left for the user per
      instructions.

## Status
Created 2026-09-29, following Part 1. T1-T6 done. One out-of-scope,
pre-existing floating-point number-to-string formatting issue found and
reported (see T4), not fixed — full suite is 1 failed / 1452 passed / 2
skipped, not 0 failures, because of that single unrelated assertion.

---

# Part 3: XPath number→string formatting leaks floating-point noise

## Objective
Fix the XPath engine's number-to-string conversion (used when a numeric
`calculate` result like `lamina_aplicada` is coerced to its `string`-typed
bind) so it does not leak raw JS floating-point artifacts, e.g.
`0.0029088000000000004` instead of `0.0029088`, matching the real "Lecturas
de Riego" form's `lamina_aplicada` calculate:
`(volumen_aplicado div superficie) * 0.01`.

## Why
Confirmed by Part 2's agent: `7.272/25*0.01` in plain Node.js already
produces `0.0029088000000000004` — this is standard IEEE-754 double
imprecision, not a bug introduced by this feature. The XPath engine's
number→string formatter passes that raw JS number through without
XPath-spec-compliant formatting. The real production form (and presumably
any numeric `calculate` with division/multiplication chains) can surface
this any time the exact result isn't representable in binary floating
point.

## Product/engine decision
XPath 1.0's `number-to-string` conversion has a defined algorithm (roughly:
shortest decimal representation that round-trips to the same IEEE-754
double, similar to what `Number.prototype.toString()` already does in JS —
verify whether the engine is even using `toString()` or something else,
e.g. `toFixed`/manual string-building, before assuming the fix is
"round more"). Investigate the ACTUAL current formatting code path before
changing it — do not blindly apply `toFixed(n)` or similar, since that can
break other currently-passing tests expecting full precision or different
rounding.

## Scope
- Find the XPath number→string conversion function (likely near
  `src/xpath/vendor/xpath/functions/` or a core `NumberFunction`/string
  coercion utility — search for where a JS `number` becomes the `string`
  representation for XPath results, e.g. grep for `toString()` calls on
  numeric results, or an existing `numberToString`/`formatNumber`-style
  helper).
- Existing RED test:
  `tests/equivalence/forms/lecturas-de-riego-calculations.test.ts` —
  `lamina_aplicada` assertion currently fails
  (`expected "0.0029088", received "0.0029088000000000004"`).
- Check the vendored reference implementation
  (`reference/web-forms/packages/xpath/...`, read-only) for how upstream
  JavaRosa/web-forms handles this — XPath 1.0 spec compliance may already
  be solved there and just not ported/used correctly here.

## Constraints
- TDD strict mode: add focused unit tests for the number→string function
  directly (not just the end-to-end form test) covering: an exact/clean
  decimal result (must stay exact), a result with known floating-point
  noise (like this one), a very small number, a very large number, and
  negative numbers — before changing the implementation.
- Do NOT touch time/date code (`decimal-time`, `predicates.ts`,
  `coercion.ts`, `codecs.ts`) — Parts 1 and 2 are done; this is purely
  about numeric-to-string formatting.
- Full suite must be 0 failures when done. If a genuinely correct fix here
  is large/risky/ambiguous (e.g. touches many currently-passing snapshot-
  style assertions), STOP and report back with findings/tradeoffs instead
  of forcing a change — this is real production numeric-output behavior,
  don't guess.

## Tasks
- [x] T1: Located the exact conversion:
      `src/xpath/vendor/xpath/evaluations/NumberEvaluation.ts:24` —
      `this.stringValue = Number.isNaN(value) ? 'NaN' : String(value);`
      inside the `NumberEvaluation` constructor (used for XPath NUMBER-typed
      results). Consumed by `NumberResult.stringValue` (`.../evaluator/result/NumberResult.ts:22`,
      `evaluation.toString()`) when a numeric `calculate` result is coerced
      to its `string`-typed bind. `String(value)` is JS's own spec-defined
      (ECMA-262 `ToString` on Number) shortest-round-trip decimal
      representation — not `toFixed`/manual string building.
- [x] T2: Confirmed current RED:
      `npx vitest run tests/equivalence/forms/lecturas-de-riego-calculations.test.ts`
      → 1 failed: `Expected string answer "0.0029088", but received
      "0.0029088000000000004"`.
- [x] T3: Added `tests/unit/xpath/number-to-string.test.ts` — 5 focused unit
      tests via `evaluateXPath("string(...)")`: exact/clean decimal (`0.5`
      stays `"0.5"`), the known floating-point-noise case
      (`7.272 div 25 * 0.01` → `"0.0029088000000000004"`, matching plain
      Node.js), a very small number (`0.0000001` → `"1e-7"`), a very large
      number (`1e23`), and a negative number (`-3.14`). All 5 pass against
      the CURRENT implementation (no RED here — these document confirmed-
      correct existing behavior, not a defect to fix).
      `npx vitest run tests/unit/xpath/number-to-string.test.ts` → 5 passed.
- [x] T4: **No fix implemented — investigated and stopping per task
      instruction #8/constraint ("if a genuinely correct fix here is
      large/risky/ambiguous, STOP and report").** Findings:
      1. Compared against the vendored upstream reference
         (`reference/web-forms/packages/xpath/src/evaluations/NumberEvaluation.ts:21`):
         `this.stringValue = Number.isNaN(value) ? '' : String(value);` —
         line-for-line the same `String(value)` approach (this repo only
         differs by correctly returning `'NaN'` instead of `''` for NaN, an
         already-fixed, unrelated prior correction). Upstream JavaRosa/
         web-forms has NOT solved this differently; there is no already-
         correct implementation to port.
      2. Verified independently in plain Node: `String(7.272/25*0.01)` →
         `"0.0029088000000000004"`, and confirmed this IS the shortest
         string that round-trips to the exact IEEE-754 double produced by
         that arithmetic (`Number("0.0029088000000000004") === 7.272/25*0.01`
         is true; `Number("0.0029088") !== 7.272/25*0.01`). `String()` is
         already performing correct XPath-1.0-equivalent shortest-round-trip
         conversion — the noise is not introduced by string conversion, it
         is baked into the double produced by the division/multiplication
         chain itself.
      3. Considered two candidate fixes and rejected both as unsafe to apply
         without a product decision:
         - **Round at the final string-cast boundary** (e.g.
           `Number(value.toPrecision(15)).toString()`). Verified this does
           produce `"0.0029088"` for the target case, but it is a global
           behavior change to every numeric `string()` conversion in the
           engine, not scoped to this form. Spot-checked it also truncates
           unrelated already-correct full-precision output, e.g.
           `1/3` → `"0.333333333333333"` (15 digits) instead of the current
           `"0.3333333333333333"` (16 digits) — a real precision loss with
           unknown blast radius across every currently-passing
           calculate/output assertion in the suite, and XPath 1.0 does not
           define a "round to N significant digits" string conversion, so
           this would not be spec-compliant either, just a heuristic.
         - **Arbitrary-precision decimal arithmetic throughout the engine**
           (e.g. `decimal.js`) — the only approach that would produce
           *exactly* `0.0029088` without ad hoc rounding, but is a genuinely
           large architectural change (would touch every numeric operator,
           not just `string()` coercion), explicitly out of Part 3's scope.
      4. No existing test in the suite locks in the specific noisy value or
         any other full-16-digit floating output as "the" correct answer —
         `grep`-checked `tests/equivalence/xpath/functions.test.ts` and
         `tests/equivalence/dag/calculate.test.ts` for numeric-string
         assertions; none exist beyond the ported ODK/JavaRosa functions
         already covered. This means there is no test currently proving the
         15-significant-digit rounding heuristic is unsafe, but there is
         also no evidence it's safe — it is an ambiguous product/engine
         decision, not a confirmed bug fix.
      **Recommendation:** this is not a code defect in the number→string
      formatter; it is expected IEEE-754 behavior, matching upstream
      JavaRosa/web-forms exactly. Options, for a human decision:
      (a) leave as-is (spec-correct, matches upstream, but leaks noise on
      forms like this one) — my default recommendation since it's already
      correct and matches upstream;
      (b) round to a fixed number of significant digits at the final
      `string()` boundary as a deliberate, scoped product decision (needs
      sign-off on the digit count and full-suite regression review, since it
      changes precision engine-wide); or
      (c) a much larger decimal-arithmetic migration (not proposed for this
      task).
      Did not alter the `lamina_aplicada` assertion — it correctly documents
      the real, currently-produced value.
- [x] T5: Fixture test remains RED (unchanged, since no fix was applied —
      see T4). Full suite: `npx vitest run` → 123 files passed, 1 file
      failed (same `lecturas-de-riego-calculations.test.ts` assertion),
      1457 passed / 1 failed / 2 skipped (1460 total). This is NOT 0
      failures — expected, given the T4 stop decision; every other test,
      including the 5 new unit tests, is green.
- [x] T6: This doc updated with evidence. Commit left for the user (and no
      commit was made regardless, per instruction #10).

## Status
Created 2026-09-29, following Part 2. Investigated and STOPPED at T4 without
forcing a fix — confirmed no formatting defect exists (matches upstream
reference exactly); the noise is genuine IEEE-754 arithmetic imprecision.
Recommendation and tradeoffs recorded above for a human product decision.

---

# Part 4: Port JavaRosa's number→string guard clauses

## Objective
Bring `src/xpath/vendor/xpath/evaluations/NumberEvaluation.ts`'s number→
string conversion into fidelity with the ORIGINAL JavaRosa (Java) engine's
`XPathFuncExpr.toString(Object)`, which has two guard clauses ts-rosa
currently lacks. This is a fidelity/correctness alignment with the
reference engine, not a fix for the `lamina_aplicada` case specifically
(user-confirmed: neither guard changes that case's output — it's neither
near-zero nor near-integer).

## Why
Verified directly from JavaRosa's source
(https://github.com/getodk/javarosa/blob/master/src/main/java/org/javarosa/xpath/expr/XPathFuncExpr.java#L804,
`toString(Object)`, lines 804-834):

```java
} else if (o instanceof Double) {
    double d = (Double) o;
    if (Double.isNaN(d)) {
        val = "NaN";
    } else if (Math.abs(d) < 1.0e-12) {
        val = "0";
    } else if (Double.isInfinite(d)) {
        val = (d < 0 ? "-" : "") + "Infinity";
    } else if (Math.abs(d - (int) d) < 1.0e-12) {
        val = String.valueOf((int) d);
    } else {
        val = String.valueOf(d);
    }
}
```

ts-rosa's current `NumberEvaluation.ts:24` is just
`Number.isNaN(value) ? 'NaN' : String(value)` — missing:
1. **Snap-to-zero**: `|d| < 1e-12` → `"0"` (avoids emitting e.g.
   `"1e-13"` or similar sub-epsilon noise as a nonzero string).
2. **Near-integer truncation**: `|d - Math.trunc(d)| < 1e-12` → the
   truncated integer as a string (avoids `.99999999999998`-style noise
   right next to a whole number), matching Java's `(int) d` truncation
   semantics (toward zero), not rounding.

Note Java's `Double.isInfinite(d)` check is ALSO missing in ts-rosa's
current code — verify during T1 whether ts-rosa's `String(value)` already
handles `Infinity`/`-Infinity` correctly (JS's `String(Infinity)` =
`"Infinity"`, `String(-Infinity)` = `"-Infinity"` — likely already fine,
but confirm and add an explicit guard/test only if it's actually wrong).

## Scope
- `src/xpath/vendor/xpath/evaluations/NumberEvaluation.ts` only.
- Do NOT touch `reference/web-forms/...` (read-only vendored reference —
  it intentionally does NOT have these guards either; this is ts-rosa
  choosing to diverge from that reference to match the ORIGINAL Java
  engine more closely, a deliberate, user-confirmed decision).
- Also fix the `lamina_aplicada` assertion in
  `tests/equivalence/forms/lecturas-de-riego-calculations.test.ts` to the
  real produced value (`'0.0029088000000000004'`), since Part 3 confirmed
  neither new guard changes this specific case's output — document in a
  test comment that this is expected IEEE-754 behavior matching JavaRosa,
  not a remaining bug.

## Constraints
- TDD strict mode: write failing tests for both guards first (RED), using
  values that trigger each guard, e.g.:
  - snap-to-zero: a computation producing a double with `|d| < 1e-12` but
    not exactly `0` (e.g. `1e-13`, or an arithmetic chain that lands there)
    → expect `"0"`.
  - near-integer: a computation producing e.g. `6.999999999999995` (within
    1e-12 of `7`) → expect `"7"`, and confirm truncation-toward-zero
    semantics for a negative near-integer too (e.g. `-6.9999999999999995`
    → `"-7"`, matching Java's `(int) d` truncation... verify actual Java
    `(int)` cast semantics for negative doubles precisely, don't assume).
  - confirm existing correct cases still pass: `0.5`, large numbers,
    exact integers, the `lamina_aplicada`-style full-noise case (unchanged
    by these guards).
- Full suite must be 0 failures when done (including the corrected
  `lamina_aplicada` assertion).

## Tasks
- [x] T1: Read `NumberEvaluation.ts` in full; confirm `Infinity`/`-Infinity`
      handling is already correct via plain `String()` or needs an
      explicit guard.
      Evidence: `node -e "console.log(String(Infinity), String(-Infinity))"`
      → `Infinity -Infinity`. Already correct; no explicit guard added,
      only a comment noting this was verified.
- [x] T2: Write failing unit tests for both guards (RED) in
      `tests/unit/xpath/number-to-string.test.ts` (extend the file Part 3
      already created).
      Evidence: `npx vitest run tests/unit/xpath/number-to-string.test.ts`
      → 4 failed | 5 passed (9) before implementation (RED confirmed for
      the 4 new cases: sub-epsilon positive/negative, near-integer
      positive/negative).
- [x] T3: Implement both guards in `NumberEvaluation.ts`, matching Java's
      exact semantics (truncation toward zero for near-integer, not
      rounding). Used `Math.trunc()` — verified it truncates toward zero
      for all tested values (e.g. `Math.trunc(-6.999999999999999) === -6`,
      `Math.trunc(-7.0000000000001) === -7`), matching Java's documented
      `(int)` narrowing-conversion semantics (JLS §5.1.3: discards the
      fractional part, i.e. truncation toward zero) for the finite,
      in-range doubles this codebase deals with.
- [x] T4: Confirm GREEN for the new unit tests; update the
      `lamina_aplicada` assertion in the fixture test to the real value
      with an explanatory comment; confirm that test file is fully GREEN.
      Evidence: `npx vitest run tests/unit/xpath/number-to-string.test.ts`
      → 9 passed (9). `npx vitest run
      tests/equivalence/forms/lecturas-de-riego-calculations.test.ts`
      → 1 passed (1).
- [x] T5: Run full suite, must be 0 failures; record evidence.
      Evidence: `npx vitest run` → Test Files 124 passed (124); Tests 1462
      passed | 2 skipped (1464). 0 failures.
- [x] T6: Update this doc with evidence (this edit).

## Status
Completed 2026-09-29. Both JavaRosa guard clauses (snap-to-zero,
near-integer truncation-toward-zero) ported into `NumberEvaluation.ts`
using `Math.trunc()`. `lamina_aplicada` assertion corrected to
`'0.0029088000000000004'` with an explanatory comment. Full suite green
(0 failures). Not committed per task instructions.
