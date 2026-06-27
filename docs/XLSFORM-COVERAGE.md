# XLSForm Column Coverage

Mapping of XLSForm survey columns to ts-rosa engine support.

| # | Column | XML Equivalent | ts-rosa | Notes |
|---|--------|---------------|---------|-------|
| 1 | `type` | `bind type` | ✅ | `DataBinding.dataType` |
| 2 | `name` | `nodeset` ref | ✅ | `FormElement.ref` |
| 3 | `label` | `<label>` body element | ✅ | `FormElement.labelText` + `labelInnerText` |
| 4 | `hint` | `<hint>` body element | ✅ | `FormElement.hintText` |
| 5 | `required` | `bind required` | ✅ | `DataBinding.required` |
| 6 | `relevant` | `bind relevant` | ✅ | `DataBinding.relevant` |
| 7 | `appearance` | `appearance` attribute | ✅ | `FormElement.appearance` |
| 8 | `default` | Instance XML text content | ✅ | `InstanceNode.value` via `applyBindings` |
| 9 | `constraint` | `bind constraint` | ✅ | `DataBinding.constraint` |
| 10 | `constraint_message` | `jr:constraintMsg` | ✅ | `DataBinding.constraintMsg` |
| 11 | `calculation` | `bind calculate` | ✅ | `DataBinding.calculate` |
| 12 | `trigger` | `setvalue` actions | 🟡 | ~500 lines. Deferred. |
| 13 | `choice_filter` | `itemset nodesetExpr` | ✅ | `FormElement.itemset` |
| 14 | `parameters` | `odk:parameters` | 🟡 | ~100 lines. Deferred. |
| 15 | `repeat_count` | `jr:count` | ✅ | `FormElement.countExpr` |
| 16 | `note` | `readonly=true()` display | ✅ | `DataBinding.readonly` |
| 17 | `image` | `upload mediatype="image/*"` | ✅ | `FormElement.mediatype` |
| 18 | `audio` | `upload mediatype="audio/*"` | ✅ | `FormElement.mediatype` |
| 19 | `video` | `upload mediatype="video/*"` | ✅ | `FormElement.mediatype` |

## Coverage: 16/19 columns (84%)

### Fully Supported (16)
All core survey logic: types, labels, hints, validation, branching, calculations, repeats, media uploads, dynamic choices.

### Deferred (2)
- **`trigger`**: Requires ActionController + event system (`xforms-ready`, `jr:insert`, `odk:new-repeat`). Estimated ~500 lines.
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
| `rank` | Not yet | Not yet |
