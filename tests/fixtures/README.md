# tests/fixtures/

Vendored XML fixture files for ported test suites.

## Task 7 — Fixture audit result

All tests selected for porting from `TriggerableDagTest` use the **inline DSL**
(`XFormsElement` / `BindBuilderXFormsElement` builders) to construct form
definitions programmatically. None of the ported tests reference external `.xml`
fixture files from `reference/javarosa/src/test/resources/`.

**Outcome**: Task 7 is a no-op for this slice. No files were copied.

## Adding fixtures in future slices

If a future ported test requires an external fixture file, copy it from:

```
reference/javarosa/src/test/resources/<relative-path>.xml
```

to:

```
tests/fixtures/<relative-path>.xml
```

and document the source path in a comment at the top of the test file that
references it. The fixture must be self-contained (no runtime reference to
`reference/javarosa/`).
