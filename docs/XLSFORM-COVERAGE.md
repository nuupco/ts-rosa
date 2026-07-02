# XLSForm Column Coverage

Mapping of XLSForm survey columns to ts-rosa engine support.

| # | Column | XML Equivalent | ts-rosa | Notes |
|---|--------|---------------|---------|-------|
| 1 | `type` | `bind type` | ✅ | `DataBinding.dataType` |
| 2 | `name` | `nodeset` ref | ✅ | `FormElement.ref` |
| 3 | `label` | `<label>` body element | ✅ | `FormElement.labelText` + `labelInnerText`; itext-driven labels and embedded `<output>` placeholders are substituted at read time via `getQuestionAtIndex().getQuestionText()` |
| 4 | `hint` | `<hint>` body element | ✅ | `FormElement.hintText`; itext-driven hints and embedded `<output>` placeholders are substituted at read time via `getQuestionAtIndex().getSubstitutedHintText()` |
| 5 | `required` | `bind required` | ✅ | `DataBinding.required` |
| 6 | `relevant` | `bind relevant` | ✅ | `DataBinding.relevant` |
| 7 | `appearance` | `appearance` attribute | ✅ | `FormElement.appearance` |
| 8 | `default` | Instance XML text content | ✅ | `InstanceNode.value` via `applyBindings` |
| 9 | `constraint` | `bind constraint` | ✅ | `DataBinding.constraint` |
| 10 | `constraint_message` | `jr:constraintMsg` | ✅ | `DataBinding.constraintMsg` |
| 11 | `calculation` | `bind calculate` | ✅ | `DataBinding.calculate` |
| 12 | `trigger` | `setvalue` actions | ✅ | `odk-instance-first-load`/`xforms-ready` (load-time) and `xforms-value-changed` (dependency-triggered) events only; see notes below for remaining gaps. |
| 13 | `choice_filter` | `itemset nodesetExpr` | ✅ | `FormElement.itemset` |
| 14 | `parameters` | `odk:parameters` | 🟡 | ~100 lines. Deferred. |
| 15 | `repeat_count` | `jr:count` | ✅ | `FormElement.countExpr` |
| 16 | `note` | `readonly=true()` display | ✅ | `DataBinding.readonly` |
| 17 | `image` | `upload mediatype="image/*"` | ✅ | `FormElement.mediatype` |
| 18 | `audio` | `upload mediatype="audio/*"` | ✅ | `FormElement.mediatype` |
| 19 | `video` | `upload mediatype="video/*"` | ✅ | `FormElement.mediatype` |

## Coverage: 17/19 columns (89%)

### Fully Supported (17)
All core survey logic: types, labels, hints, validation, branching, calculations, repeats, media uploads, dynamic choices, and `<setvalue>` actions (see below for the v1 event/scope boundary).

### `trigger` (`<setvalue>` actions) — v1 scope
Implemented (sdd/setvalue-actions):
- Events: `odk-instance-first-load` (and its `xforms-ready` alias) — fires once, after the initial DAG cascade, in declaration order; and `xforms-value-changed` — fires when the action's trigger ref(s) change (union of the value expression's own XPath dependencies and, for body-nested actions, the host control's ref — a deliberately broader v1 trigger set than strict JavaRosa host-only semantics, see design Requirement 5).
- Both absolute and simple host-relative (non-repeat) target refs.
- A runtime `MAX_ACTION_CHAIN_DEPTH=16` guard bounding chained value-changed action cascades (fails loud on runaway/cyclic chains).
- Any other `event` value fails loudly at parse time (no silent skip).

Deferred (out of v1 scope, tracked for a future change):
- `odk-new-repeat`, `jr:insert`, `xforms-revalidate` events.
- `odk:setgeopoint`, `odk:recordaudio`, and rank action variants.
- Repeat-relative target refs (e.g. `/data/repeat[position()=1]/x`) — parser rejects fail-loud rather than silently mis-resolving.
- `$var` variable binding via setvalue.
- Attribute-node targets (`ref="/data/x/@attr"`) — no attribute-node addressing anywhere in the engine yet, not setvalue-specific.
- Strict host-ref-only triggering + same-value short-circuit (JavaRosa parity edge case) — ts-rosa's v1 trigger set is a superset of JavaRosa's; see `tests/equivalence/actions/setvalue-action.test.ts` header for the documented deviation and its evidence.

### Deferred (1)
- **`parameters`**: Requires `odk:parameters` parsing + RN intent integration. Estimated ~100 lines.

### Not Yet Needed (0)
All other columns are covered.

## Control Types

| XLSForm `type` | ts-rosa `controlType` | Widget |
|----------------|----------------------|--------|
| `text` | `input` (string) | TextInput |
| `integer` | `input` (int) | Numeric |
| `decimal` | `input` (decimal) | Numeric |
| `date` | `input` (date) | DatePicker |
| `dateTime` | `input` (dateTime) | DateTimePicker |
| `time` | `input` (time) | TimePicker |
| `geopoint` | `input` (geopoint) | Coordinates |
| `barcode` | `input` (barcode) | Camera |
| `select_one` | `select1` | Single picker |
| `select_multiple` | `select` | Multi picker |
| `image` | `upload` (image/*) | Camera/Gallery |
| `audio` | `upload` (audio/*) | Microphone |
| `video` | `upload` (video/*) | Camera |
| `file` | `upload` (*/*) | File picker |
| `range` | `range` | Slider |
| `secret` | `secret` | Password |
| `note` | `input` (readonly) | Label only |
| `trigger` | `trigger` | Button |
| `rank` | `rank` (reuses `select`'s selectMulti codec/DataType) | Not yet (drag-to-reorder UI is a consumer concern; permutation validation deferred) |
