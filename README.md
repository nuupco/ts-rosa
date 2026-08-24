# @nuup/ts-rosa

> TypeScript XForms engine — behavior-compatible reimplementation of JavaRosa.

## What is it?

`@nuup/ts-rosa` is a pure TypeScript XForms engine that parses ODK XForms XML and runs them programmatically. It's a faithful port of JavaRosa (the engine that powers ODK Collect, Enketo, and ODK Central), designed for React Native / Hermes.

**1300+ tests.** No DOM, no WASM, no Node-specific APIs. Runtime dependencies are limited to `@xmldom/xmldom`, `crypto-js`, and `temporal-polyfill` — the same three packages are declared under `dependencies` and marked `external` in the build, so they resolve from your project's `node_modules` instead of being duplicated inside the bundle.

## Quick Start

Not published to npm yet — install directly from GitHub (`dist/` is
committed to the repo, so no build step is required on install):

```bash
npm install github:nuupco/ts-rosa
```

Register an `XmlParser` provider once at bootstrap (the engine never calls
`new DOMParser()` internally — see [Platform Setup](#platform-setup)):

```ts
import { registerXmlParser } from '@nuup/ts-rosa';
import { DOMParser, DOMImplementation } from '@xmldom/xmldom';

registerXmlParser({
  parse(xml) {
    return new DOMParser().parseFromString(xml, 'text/xml');
  },
  createDocument(rootTagName) {
    return new DOMImplementation().createDocument(null, rootTagName, null);
  },
});
```

```ts
import { parseForm, createFormSession } from '@nuup/ts-rosa';

// 1. Parse an XForm
const def = parseForm(formXml);

// 2. Create a session
const session = createFormSession(def);

// 3. Navigate and answer
const { navigator, evaluator } = session;
navigator.stepToNextEvent();           // advance to first question
const ref = navigator.refAtIndex();    // get current question ref
evaluator.answerQuestion(ref, 'yes');  // answer it

// 4. Get final XML
const xml = session.serializeToXml();
```

## Editing an Existing Submission

Pass `instanceXml` to hydrate a session from a previously-submitted instance
instead of starting from the form's template defaults:

```ts
const session = createFormSession(def, { instanceXml: previousSubmissionXml });
```

Semantics:

- **Repeat multiplicity** is restored from the submission XML — one instance node per matching element, including nested repeats.
- **`calculate` always recomputes.** The full initial DAG cascade runs unconditionally, so any `calculate`-bound node's final value is the freshly computed result, not the loaded value.
- **Preloads are skipped.** `jr:preload` values (timestamps, uids) from the original submission are preserved as-is; they are not regenerated.
- **Strict drift policy.** An unknown/extra node in the submission XML, a root-name mismatch, an unexpected multiplicity on a non-repeat node, or a value that fails to cast throws `HydrationError` (with the offending node's path). A node the template declares but the submission omits silently falls back to its template default — no error.
- **Round-trip is semantic, not always lexical**, for `decimal` (`1` → `1.0`), `date`/`time`/`dateTime` (normalized to UTC), geo types (component reformatting), and `selectMulti` (whitespace collapsed). All other types round-trip byte-for-byte.

`hydrateInstance(definition, instanceXml)` is also exported standalone for
building an `InstanceTree` without going through `createFormSession`.

## External Secondary Instances (`jr://file-csv/*.csv`)

Forms may declare a secondary instance whose content lives outside the form
XML, referenced by a `jr://` URI:

```xml
<instance id="cities" src="jr://file-csv/cities.csv"/>
```

`parseForm` stays synchronous and never does I/O: it records `{ id, src }`
markers on `FormDefinition.externalInstances` instead of loading content.
Hydration is a separate, explicit async step the host calls before creating
a session:

```ts
import {
  parseForm,
  registerExternalInstanceResolver,
  resolveExternalInstances,
  createFormSession,
} from '@nuup/ts-rosa';

// 1. Register a resolver once at bootstrap — the engine never fetches files
//    or network resources itself.
registerExternalInstanceResolver({
  async resolve(uri) {
    // e.g. read from the form's media attachments folder
    return readCsvFile(uri);
  },
});

// 2. Parse (sync, pure — no I/O yet)
const def = parseForm(formXml);

// 3. Hydrate external instances (async — fetches + parses CSV)
const resolved = await resolveExternalInstances(def);

// 4. Create the session as usual, from the resolved definition
const session = createFormSession(resolved);
```

CSV content is parsed into the exact same `root`/`item`/`{column}` shape as
an inline secondary instance, so `instance()`, `pulldata()`, `search()`, and
`<itemset>` all work with **zero changes** — a CSV-hydrated instance is
indistinguishable in shape from an equivalent inline one.

**Fail-loud behavior:**

- `getExternalInstanceResolver()` throws if no resolver was registered.
- A rejecting `resolve()` call throws `resolveExternalInstances: failed to resolve external instance '<id>' (<src>): <cause>`.
- Malformed CSV throws `resolveExternalInstances: external instance '<id>' (<src>) has malformed CSV: <detail>`.
- Calling `createFormSession(def)` with a declared-but-unresolved external instance throws `createFormSession: external instance '<id>' is declared but not resolved. Call resolveExternalInstances(definition) before createFormSession().` — this prevents an unresolved external from silently behaving as an absent/empty instance.

**Also supported, beyond CSV:**

- XML-shaped externals (`jr://file/*.xml`, any `src` ending in `.xml`) —
  parsed via the same tree-building machinery as inline secondary
  instances. Fail-loud: a `null` resolver result or malformed/rootless XML
  throws.
- Last-saved instances (`jr://instance/last-saved`) — parsed as XML with
  relaxed/tolerant schema drift handling. A `null` resolver result (no
  prior submission) yields an empty-root tree named after the form's own
  primary instance root, instead of throwing.

## Architecture

```
XForm XML
  → parseForm()       → FormDefinition (body tree + bindings + itext)
  → createFormSession  → FormSession   (navigator + evaluator)
  → navigator          → FormNavigator (cursor, next/prev, events)
  → evaluator          → FormEvaluator (answer, validate, relevance)
  → serializeToXml()   → string XML
```

## API Stability

`@nuup/ts-rosa` is at `0.x`. Per semver, breaking changes may land in **minor** releases until `1.0.0`. The exported surface of the package entry point is frozen by a contract test, so additions and removals are always intentional and recorded in [CHANGELOG.md](CHANGELOG.md). Pin an exact version and coordinate upgrades with the maintainers (e.g. `xform-native`) until `1.0.0`.

## What it supports

| Feature | Status |
|---------|--------|
| XPath expressions | ✅ Full XPath 1.0 |
| `calculate`, `relevant`, `required`, `readonly` | ✅ |
| `constraint` + `jr:constraintMsg` | ✅ |
| `select1` + `select` (static + dynamic itemsets) | ✅ |
| `repeat` groups with `jr:count` | ✅ |
| `jr:preload` (date, timestamp, uid, property) | ✅ |
| Itext translations (multi-language) | ✅ |
| Geopoint, date, dateTime, barcode types | ✅ |
| `appearance` attribute (signature, multiline, etc.) | ✅ |
| ODK functions (uuid, regex, pulldata, randomize, once) | ✅ |
| Serialization (instance → XML) | ✅ |
| Validation (required + constraint sweep) | ✅ |

See [docs/XLSFORM-COVERAGE.md](docs/XLSFORM-COVERAGE.md) for detailed column mapping.

## Platform Setup

`ts-rosa` never imports DOM/WASM/Node globals directly — consumers wire an
environment-specific provider through two seams at bootstrap, before parsing
or evaluating any form:

| Export | Description |
|--------|-------------|
| `registerXmlParser(provider)` | Register the `XmlParser` used for `parse()` and, if implemented, stub-document creation for context-free XPath evaluation. |
| `getXmlParser()` | Retrieve the registered provider. Throws a clear error if called before `registerXmlParser`. |
| `registerPlatformConfig({ timeZoneId })` | Optional. Overrides the IANA time zone (default `"UTC"`) used by date/time-dependent XPath evaluation — call before any XPath evaluation runs. |
| `registerExternalInstanceResolver(provider)` | Optional — only required for forms using `jr://` external secondary instances. Register the resolver used by `resolveExternalInstances()` to fetch raw external instance content. See [External Secondary Instances](#external-secondary-instances-jrfile-csvcsv). |
| `getExternalInstanceResolver()` | Retrieve the registered provider. Throws a clear error if called before `registerExternalInstanceResolver`. |

`XmlParser.createDocument(rootTagName)` is optional but required in practice:
the XPath seam needs a stub document when evaluating expressions without a
context node, and throws a descriptive error if the registered provider
doesn't implement it.

## API Reference

### Parsing

| Export | Description |
|--------|-------------|
| `parseForm(xml: string)` | Parse XForm XML → `FormDefinition` |
| `resolveExternalInstances(def)` | Async. Fetches and parses declared `jr://` external secondary instances (via the registered `ExternalInstanceResolver`), returning a new `FormDefinition` with them merged into `secondaryInstances`. See [External Secondary Instances](#external-secondary-instances-jrfile-csvcsv). |

### Session

| Export | Description |
|--------|-------------|
| `createFormSession(def, opts?)` | Create a `FormSession` with navigator + evaluator. Pass `opts.instanceXml` to hydrate the session from a previously-submitted instance for editing — see [Editing an Existing Submission](#editing-an-existing-submission). |
| `frozenPreloadProvider(opts?)` | Deterministic preload provider for tests |
| `hydrateInstance(definition, instanceXml)` | Standalone hydrator: builds an `InstanceTree` from `definition` populated with `instanceXml`'s values and repeat multiplicity |
| `HydrationError` | Thrown by `hydrateInstance`/`createFormSession` on root-name mismatch, unknown/extra submission nodes, unexpected multiplicity, or a value that fails to cast |

### FormSession

| Property | Type | Description |
|----------|------|-------------|
| `definition` | `FormDefinition` | Parsed form structure |
| `navigator` | `FormNavigator` | Cursor navigation |
| `evaluator` | `FormEvaluator` | Answer, validate, relevance |
| `serializeToXml()` | `() => string` | Serialize instance tree to XML |

### FormNavigator

| Method | Description |
|--------|-------------|
| `stepToNextEvent()` | Advance cursor to next relevant question |
| `stepToPreviousEvent()` | Go back |
| `refAtIndex()` | Get current question's `TreeReference` |
| `atTheEndOfForm()` | Is the form complete? |
| `getEvent()` | Current event type (QUESTION, REPEAT, END_OF_FORM...) |
| `atQuestion()` | Is cursor at a question? |

### FormEvaluator

| Method | Description |
|--------|-------------|
| `answerQuestion(ref, value)` | Submit answer, returns `AnswerResult` |
| `isEffectivelyRelevant(ref)` | Is a node visible (own + ancestors relevant)? |
| `getChoices(ref)` | Get dynamic select choices |
| `validate(nodesets)` | Full-form validation sweep |
| `getLanguages()` | Available itext languages |
| `setLanguage(lang)` | Switch active language |

### AnswerResult

| Value | Meaning |
|-------|---------|
| `OK` | Answer accepted |
| `CONSTRAINT_VIOLATED` | Failed constraint check |
| `REQUIRED_BUT_EMPTY` | Required field left empty |

## Development

```bash
bun install
bun run test        # unit + equivalence suite
bun run test:e2e    # builds dist/ then runs the published-entry-point E2E test
bun run typecheck   # strict TypeScript
bun run build       # tsup → dist/
```

## License

Apache-2.0
