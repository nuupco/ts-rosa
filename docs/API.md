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
