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
| 12 | `trigger` | `setvalue` actions | ✅ | `odk-instance-first-load`/`xforms-ready`, `xforms-value-changed`, `odk-new-repeat`, and `jr-insert` events; runtime target ref resolution (repeat-relative, `$var`); see notes below for remaining gaps. |
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

### `trigger` (`<setvalue>` actions)
Implemented (sdd/setvalue-actions, sdd/setvalue-parity):
- Events: `odk-instance-first-load` (and its `xforms-ready` alias), `xforms-value-changed`, `odk-new-repeat`, and `jr-insert` (model-level only, matching JavaRosa's deprecated non-namespaced token — fires before the DAG cascade, alongside `odk-new-repeat`, from repeat-instance creation).
- Multiple space-separated events on one `<setvalue>` (one action per token).
- Target refs resolved at runtime through the XPath seam: absolute, host-relative, repeat-relative (`..`, `[position()=1]`), and `$var`-rooted. Fails loud on a target resolving to zero or multiple nodes (no first-match fallback, no silent no-op).
- A runtime `MAX_ACTION_CHAIN_DEPTH=16` guard bounding chained action cascades (fails loud on runaway/cyclic chains).
- Any other `event` value fails loudly at parse time (no silent skip).
- Breaking change (0.x, no deprecation path): `parseAbsoluteRef` now fails loud on non-numeric predicates (e.g. `[position()=1]` outside a resolved target context) instead of silently resolving to `INDEX_UNBOUND`.

Deferred (out of scope, tracked for a future change):
- `xforms-revalidate` — no `postProcessInstance`/finalize lifecycle exists in ts-rosa to bind this event to; JavaRosa fires it only from that phase.
- `odk:setgeopoint`, `odk:recordaudio`, and rank action variants — no platform seam for geolocation/audio exists in ts-rosa or in the ODK reference implementation (`reference/web-forms` also has this as an unresolved TODO).
- Strict host-ref-only triggering + same-value short-circuit (JavaRosa parity edge case) — ts-rosa's `xforms-value-changed` trigger set is a superset of JavaRosa's; see `tests/equivalence/actions/setvalue-action.test.ts` header for the documented deviation and its evidence.

### Deferred (1)
- **`parameters`**: Requires `odk:parameters` parsing + RN intent integration. Estimated ~100 lines. Descoped — not needed by product, not planned.

### Attribute-node addressing (`ref="/data/x/@attr"`) — deliberately not implemented
The `attribute::` axis is already fully supported by the vendored XPath evaluator (`src/xpath/vendor/xpath/evaluator/step/Step.ts`) for general XPath expressions. The gap is narrower than it looks: only the lightweight binding/setvalue ref path (`TreeReference`/`parseAbsoluteRef`) has no concept of an attribute as an addressable node — every ref segment is parsed as an element name, so `@attr` is silently misinterpreted rather than rejected.

Decision: **not implementing.** Extending `TreeReference` to model attributes as addressable nodes touches the engine's core reference type for every consumer (bindings, setvalue targets, repeat resolution), a real architectural cost. Real-world XLSForm/XForms usage of attribute-node targeting in `ref=`/`nodeset=` is marginal — mostly internal (`jr:template`) rather than an author-facing pattern — so the cost isn't justified by demonstrated demand. Revisit only if a concrete form requires it.

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
| `rank` | `rank` (reuses `select`'s selectMulti codec/DataType) | Drag-to-reorder UI is a consumer concern (out of engine scope). Permutation validation (no dup/missing/extra vs. itemset) is in progress — scoped to `rank` only, not a general itemset-membership validator for `select`/`select1` (neither has one today; see sdd/attribute-addressing-rank). |
