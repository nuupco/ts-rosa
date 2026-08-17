import { describe, expect, expectTypeOf, it } from "vitest";
import * as pkg from "../../src/index.ts";
import type {
  ExternalInstanceResolver,
  FormEntryEvent,
  FormIndex,
  FormNavigator,
  XmlParser,
} from "../../src/index.ts";

// Frozen public surface. Changing this list is a PUBLIC API CHANGE:
// update the array AND add a CHANGELOG entry in the same commit.
// NOTE: Object.keys() sees runtime values only — `export type` drift is
// covered by the expectTypeOf block below, not by this list.
const EXPECTED_RUNTIME_EXPORTS: readonly string[] = [
  "AnswerResult",
  "DEFAULT_MULTIPLICITY",
  "FORM_ENTRY_EVENT",
  "FormEvaluator",
  "FormNavigator",
  "HydrationError",
  "INDEX_ATTRIBUTE",
  "INDEX_TEMPLATE",
  "INDEX_UNBOUND",
  "REF_ABSOLUTE",
  "addRepeatInstance",
  "appendChild",
  "atIndex",
  "attributeNames",
  "beginningOfForm",
  "booleanValue",
  "cast",
  "childrenNamed",
  "cloneNode",
  "contextualize",
  "controlTypeFromTag",
  "countRepeatInstances",
  "createFormSession",
  "dataTypeFromXsdName",
  "dateValue",
  "decimalValue",
  "defaultPreloadProvider",
  "deleteAttribute",
  "endOfForm",
  "extendRef",
  "frozenPreloadProvider",
  "genericize",
  "getAttribute",
  "getExternalInstanceResolver",
  "getXmlParser",
  "hydrateInstance",
  "intValue",
  "isAt",
  "isBof",
  "isEof",
  "level",
  "newNode",
  "nthRealChildNamed",
  "parentOf",
  "parseAbsoluteRef",
  "parseDocument",
  "parseForm",
  "realChildrenNamed",
  "refEquals",
  "refToString",
  "registerExternalInstanceResolver",
  "registerXmlParser",
  "removeRepeatInstance",
  "resolveAll",
  "resolveAllContextualized",
  "resolveAllWithin",
  "resolveExternalInstances",
  "resolveReference",
  "rootRef",
  "selectMultiValue",
  "selectOneValue",
  "selfRef",
  "setAttribute",
  "stringValue",
  "uncast",
  "walkControls",
];

describe("public API surface contract", () => {
  it("exports exactly the frozen set of runtime symbols", () => {
    expect(Object.keys(pkg).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS]);
  });

  it("pins load-bearing exported types", () => {
    expectTypeOf<XmlParser>().toHaveProperty("parse");
    expectTypeOf<ExternalInstanceResolver>().toHaveProperty("resolve");
    expectTypeOf<FormNavigator>().not.toBeAny();
    expectTypeOf<FormIndex>().not.toBeAny();
    expectTypeOf<FormEntryEvent>().not.toBeAny();
  });
});
