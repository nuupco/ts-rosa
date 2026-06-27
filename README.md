# @nuup/ts-rosa

> TypeScript XForms engine — behavior-compatible reimplementation of JavaRosa.

## What is it?

`@nuup/ts-rosa` is a pure TypeScript XForms engine that parses ODK XForms XML and runs them programmatically. It's a faithful port of JavaRosa (the engine that powers ODK Collect, Enketo, and ODK Central), designed for React Native / Hermes.

**1016 tests. Zero runtime dependencies.** No DOM, no WASM, no Node-specific APIs.

## Quick Start

```bash
npm install @nuup/ts-rosa
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

## Architecture

```
XForm XML
  → parseForm()       → FormDefinition (body tree + bindings + itext)
  → createFormSession  → FormSession   (navigator + evaluator)
  → navigator          → FormNavigator (cursor, next/prev, events)
  → evaluator          → FormEvaluator (answer, validate, relevance)
  → serializeToXml()   → string XML
```

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

## API Reference

### Parsing

| Export | Description |
|--------|-------------|
| `parseForm(xml: string)` | Parse XForm XML → `FormDefinition` |

### Session

| Export | Description |
|--------|-------------|
| `createFormSession(def, opts?)` | Create a `FormSession` with navigator + evaluator |
| `frozenPreloadProvider(opts?)` | Deterministic preload provider for tests |

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
bun run test        # 1016 tests
bun run typecheck   # strict TypeScript
bun run build       # tsup → dist/
```

## License

Apache-2.0
