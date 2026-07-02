# API Reference

Complete API surface of `@nuup/ts-rosa`.

## Parsing

### `parseForm(xml: string): FormDefinition`

Parses an ODK XForms XML string into a `FormDefinition`.

```ts
import { parseForm } from '@nuup/ts-rosa';

const def = parseForm(xmlString);
// def.body        — FormElement[] tree
// def.mainInstance — InstanceTree
// def.bindings    — Map<string, DataBinding>
// def.itext       — ItextTranslations | null
// def.dag         — TriggerableDag | null (null for forms without bindings)
```

### `resolveExternalInstances(def): Promise<FormDefinition>`

Fetches and parses `jr://` external secondary instances declared on
`def.externalInstances` (e.g. `<instance id="cities" src="jr://file-csv/cities.csv"/>`),
merging the result into `secondaryInstances`. `parseForm` itself stays
synchronous/pure and never does I/O — this is the only async, host-I/O-driven
step in the pipeline.

```ts
import {
  parseForm,
  registerExternalInstanceResolver,
  resolveExternalInstances,
  createFormSession,
} from '@nuup/ts-rosa';

registerExternalInstanceResolver({
  resolve: (uri) => fetchCsvText(uri), // returns Promise<string>
});

const def = parseForm(xmlString);
const resolved = await resolveExternalInstances(def);
const session = createFormSession(resolved);
```

CSV content is parsed into the same `root`/`item`/`{column}` shape as inline
secondary instances, so `instance()`, `pulldata()`, `search()`, and
`<itemset>` resolve identically with no special-casing.

Call order matters: `parseForm` → `registerExternalInstanceResolver` (once,
at bootstrap) → `resolveExternalInstances` → `createFormSession`.

Fail-loud error contract:

| Condition | Error |
|-----------|-------|
| No resolver registered | `ExternalInstanceResolver provider is not registered. Call registerExternalInstanceResolver() before resolving external instances.` |
| `resolve()` rejects | `resolveExternalInstances: failed to resolve external instance '<id>' (<src>): <cause>` |
| Malformed CSV | `resolveExternalInstances: external instance '<id>' (<src>) has malformed CSV: <detail>` |
| `createFormSession` called with an unresolved external instance still declared | `createFormSession: external instance '<id>' is declared but not resolved. Call resolveExternalInstances(definition) before createFormSession().` |

`def.externalInstances` is a `ReadonlyMap<string, { src: string }>` of
declared-but-not-yet-resolved external instances; `resolveExternalInstances`
returns a new `FormDefinition` and never mutates the one it's given.

**Out of scope / deferred:**

- `jr://file/*.xml` (XML-shaped externals) — the parser records the `src`
  URI regardless of extension, but only CSV content-parsing is implemented.
- `jr://instance/last-saved` — not implemented.

### `registerExternalInstanceResolver(provider)` / `getExternalInstanceResolver()`

```ts
interface ExternalInstanceResolver {
  resolve(uri: string): Promise<string>; // raw UTF-8 file text
}
```

Environment-injection seam (mirrors `registerXmlParser`/`getXmlParser`
exactly). The engine never fetches files or performs network I/O directly;
hosts register a provider that does, before calling `resolveExternalInstances`.

## Session

### `createFormSession(def, opts?): FormSession`

Creates an interactive form session from a parsed `FormDefinition`.

```ts
import { createFormSession, frozenPreloadProvider } from '@nuup/ts-rosa';

const session = createFormSession(def);
// or with preload:
const session = createFormSession(def, {
  preloadProvider: frozenPreloadProvider({ now: new Date('2020-01-01') })
});
```

#### Editing an existing submission (`opts.instanceXml`)

```ts
const session = createFormSession(def, { instanceXml: previousSubmissionXml });
```

When `instanceXml` is provided, the session's working tree is built via
`hydrateInstance(def, instanceXml)` instead of the template defaults. This is
additive and opt-in — omitting `instanceXml` is 100% behavior-identical to
before.

Semantics:

- `calculate` expressions ALWAYS recompute (the full initial DAG cascade runs
  unconditionally); a loaded `calculate` value is never trusted over a fresh
  computation.
- `applyPreloads` is SKIPPED — `jr:preload` values (timestamps, uids) from the
  original submission are preserved, not regenerated.
- Drift policy is strict-on-extra: a root-name mismatch, an element with no
  matching template node, unexpected multiplicity on a declared non-repeat
  node, or a value that fails `cast()` throws `HydrationError` (with the
  offending node's path). A template node the submission omits silently
  falls back to its template default.
- Round-trip (hydrate → `serializeToXml()`) is semantically, not always
  lexically, lossless for `decimal` (`"1"` → `"1.0"`), `date`/`time`/`dateTime`
  (re-emitted in canonical UTC form), geopoint/geoshape/geotrace (component
  reformatting), and `selectMulti` (whitespace collapsed between tokens). All
  other types round-trip as an exact string.

### `hydrateInstance(definition, instanceXml): InstanceTree`

Standalone hydrator used internally by `createFormSession({ instanceXml })`.
Populates a clone of `definition.mainInstance` with `instanceXml`'s values
and repeat multiplicity; does not mutate `definition`. Throws `HydrationError`
on drift (see above).

```ts
import { hydrateInstance, HydrationError } from '@nuup/ts-rosa';

try {
  const tree = hydrateInstance(def, submissionXml);
} catch (e) {
  if (e instanceof HydrationError) {
    // e.message includes the offending node's path
  }
}
```

### `FormSession`

| Property | Type | Description |
|----------|------|-------------|
| `definition` | `FormDefinition` | Parsed form |
| `navigator` | `FormNavigator` | Cursor |
| `evaluator` | `FormEvaluator` | Answers + validation |
| `serializeToXml()` | `() => string` | Output XML |

## Navigation

### `FormNavigator`

| Method | Returns | Description |
|--------|---------|-------------|
| `stepToNextEvent()` | `FormEntryEvent` | Advance to next relevant question |
| `stepToPreviousEvent()` | `FormEntryEvent` | Go back |
| `refAtIndex()` | `TreeReference \| null` | Current question path |
| `getCurrentIndex()` | `FormIndex` | Raw cursor position |
| `atTheEndOfForm()` | `boolean` | Is form complete? |
| `atQuestion()` | `boolean` | Is cursor at a question? |
| `getEvent()` | `FormEntryEvent` | Current event |
| `nextRef()` | `TreeReference \| null` | Peek next ref (non-mutating) |
| `indexOf(xpath)` | `FormIndex` | Find position by xpath |
| `jumpToIndex(idx)` | `FormEntryEvent` | Jump to position |
| `jumpToBeginningOfForm()` | `FormEntryEvent` | Reset |

### `FormEntryEvent`

```ts
type FormEntryEvent =
  | { kind: 'beginning-of-form', code: 0 }
  | { kind: 'end-of-form', code: 1 }
  | { kind: 'prompt-new-repeat', code: 2 }
  | { kind: 'question', code: 4 }
  | { kind: 'group', code: 8 }
  | { kind: 'repeat', code: 16 }
  | { kind: 'repeat-juncture', code: 32 };
```

## Evaluation

### `FormEvaluator`

| Method | Returns | Description |
|--------|---------|-------------|
| `answerQuestion(ref, value)` | `AnswerResult` | Submit answer + run cascade |
| `isEffectivelyRelevant(ref)` | `boolean` | Is node visible? |
| `getChoices(ref)` | `SelectChoice[]` | Dynamic select options |
| `validate(nodesets)` | `ValidateOutcome \| null` | Full-form validation |
| `getLanguages()` | `string[]` | Available itext languages |
| `setLanguage(lang)` | `string \| null` | Switch language |
| `getActiveLanguage()` | `string \| null` | Current language |
| `getNodeState(ref)` | `NodeState \| undefined` | Raw relevance/required/readonly |

### `AnswerResult`

```ts
enum AnswerResult {
  OK = 0,
  REQUIRED_BUT_EMPTY = 1,
  CONSTRAINT_VIOLATED = 2,
}
```

## Data Model Types

### `FormElement`

```ts
type FormElement =
  | { kind: 'question', ref, controlType, binding, labelText, labelInnerText,
      choices, itemset, appearance?, mediatype?, hintText? }
  | { kind: 'group', ref, children, labelText, appearance?, hintText? }
  | { kind: 'repeat', ref, children, labelText, countExpr?, hintText? };
```

### `DataBinding`

```ts
interface DataBinding {
  readonly ref: TreeReference;
  readonly dataType: DataType;
  readonly calculate: string | null;
  readonly relevant: string | null;
  readonly required: string | null;
  readonly readonly: string | null;
  readonly constraint: string | null;
  readonly constraintMsg: string | null;
  readonly preload: string | null;
  readonly preloadParams: string | null;
}
```

### `ControlType`

```ts
type ControlType = 'input' | 'select1' | 'select' | 'trigger' | 'upload'
                 | 'range' | 'secret' | 'unknown';
```

### `DataType`

```ts
type DataType = 'string' | 'int' | 'decimal' | 'boolean' | 'date'
              | 'dateTime' | 'time' | 'geopoint' | 'barcode'
              | 'binary' | 'select1' | 'select';
```

## Preload

### `PreloadProvider`

```ts
interface PreloadProvider {
  today(): Date;
  now(): Date;
  uid(): string;
  property(name: string): string | null;
}
```

### `frozenPreloadProvider(opts?)`

```ts
import { frozenPreloadProvider } from '@nuup/ts-rosa';

const provider = frozenPreloadProvider({
  now: new Date('2020-01-01'),
  uid: 'test-uid-42',
  properties: { deviceid: 'device-001' },
});
```
