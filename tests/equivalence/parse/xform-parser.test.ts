/**
 * Equivalence: XFormParserTest.java — subset compatible with Phase 1 surface
 *
 * Sources: reference/javarosa/src/test/java/org/javarosa/xform/parse/XFormParserTest.java
 *
 * Fixture files vendored to tests/fixtures/ from reference/javarosa/src/test/resources/:
 *   - simple-form.xml   (origin: src/test/resources/simple-form.xml)
 *   - form2.xml         (origin: src/test/resources/form2.xml)
 *
 * Tests requiring DAG evaluation, serialization/deserialization, secondary instances,
 * repeat templates, last-saved instances, or form index navigation are marked it.fails
 * with a note pointing to the enabling phase.
 *
 * JR tests ported here (parseable + read-values-from-instance):
 *   parsesSimpleForm            → formDef.getTitle() == "Simple Form"
 *   parsesForm2                 → title, child count, label text [partial: label needs navigation]
 *   spacesBetweenOutputs        → it.fails: requires form navigation (Phase 2)
 *   parsesSecondaryInstanceForm → it.fails: secondary instance (Phase 2+)
 *   parsesLastSavedInstance*    → it.fails: jr:// reference manager (Phase 2+)
 *   multipleInstancesSavesAndRestores → it.fails: serialization (Phase 3)
 *   rangeFormSavesAndRestores   → it.fails: serialization (Phase 3)
 *   parsesRankForm              → it.fails: rank control (Phase 2)
 *   parsesRangeForm             → it.fails: range control (Phase 2)
 *   parseFormWithTemplateRepeat → it.fails: repeat/DAG (Phase 2)
 */

import { describe, it, expect } from "vitest";
import { parseForm } from "../../../src/parse/XFormParser.ts";
import { Scenario } from "../../harness/Scenario.ts";
import { html, head, body, model, mainInstance, bind, input, t } from "../../harness/XFormsElement.ts";
import { resolveReference } from "../../../src/model/instance/InstanceTree.ts";
import { parseAbsoluteRef } from "../../../src/model/instance/TreeReference.ts";

// ---------------------------------------------------------------------------
// Fixture XML — vendored from reference/javarosa/src/test/resources/
// See tests/fixtures/README.md for source paths.
// ---------------------------------------------------------------------------

// Origin: reference/javarosa/src/test/resources/simple-form.xml
const SIMPLE_FORM_XML = `<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml">
    <h:head>
        <h:title>Simple Form</h:title>
        <model>
            <instance>
                <data id="collect197test">
                    <meta>
                        <instanceID/>
                    </meta>
                </data>
            </instance>
            <bind nodeset="/data/meta/instanceID" type="string" readonly="true()" calculate="concat('uuid:',uuid())"/>
        </model>
    </h:head>
    <h:body>
        <group appearance="field-list">
            <input ref="/data/meta/instanceID">
                <label>Instance ID:</label>
            </input>
        </group>
    </h:body>
</h:html>`;

// Origin: reference/javarosa/src/test/resources/form2.xml
const FORM2_XML = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml"
        xmlns:jr="http://openrosa.org/javarosa"
        xmlns:orx="http://openrosa.org/xforms"
        xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <h:head>
        <h:title>My Survey</h:title>
        <model>
            <instance>
                <data id="mysurvey" orx:version="2014083101">
                    <firstname>John</firstname>
                    <lastname/>
                    <age>10</age>
                </data>
            </instance>
            <bind nodeset="/data/firstname" type="xsd:string" required="true()"  readonly="true()"  relevant="true()" />
            <bind nodeset="/data/lastname"  type="xsd:string" required="false()" readonly="false()" relevant="false()" />
            <bind nodeset="/data/age"       type="xsd:int"    required="abc"     readonly="abc"     relevant="abc" />
        </model>
    </h:head>
    <h:body>
        <input ref="/data/firstname">
          <label>What is your first name?</label>
        </input>
        <input ref="/data/lastname">
          <label>What is your last name?</label>
        </input>
        <input ref="/data/age">
          <label>What is your age?</label>
        </input>
    </h:body>
</h:html>`;

// ---------------------------------------------------------------------------
// parsesSimpleForm — JR: assertEquals(formDef.getTitle(), "Simple Form")
// ---------------------------------------------------------------------------

describe("JR equivalence: XFormParserTest.parsesSimpleForm", () => {
  it("parses title 'Simple Form' from simple-form.xml (JR: parsesSimpleForm)", () => {
    const form = parseForm(SIMPLE_FORM_XML);
    expect(form.title).toBe("Simple Form");
  });
});

// ---------------------------------------------------------------------------
// parsesForm2 — JR: title "My Survey", 3 children, child(0).label "What is your first name?"
// ---------------------------------------------------------------------------

describe("JR equivalence: XFormParserTest.parsesForm2", () => {
  it("parses title 'My Survey' from form2.xml (JR: parsesForm2)", () => {
    const form = parseForm(FORM2_XML);
    expect(form.title).toBe("My Survey");
  });

  it("form2.xml has 3 body children (inputs) (JR: getChildren().size() == 3)", () => {
    const form = parseForm(FORM2_XML);
    expect(form.body.length).toBe(3);
  });

  it("form2.xml has initial value 'John' in /data/firstname (JR: instance initial value)", () => {
    const form = parseForm(FORM2_XML);
    const ref = parseAbsoluteRef("/data/firstname");
    const node = resolveReference(form.mainInstance, ref);
    expect(node).not.toBeNull();
    expect(node!.value?.value).toBe("John");
  });

  it("form2.xml binds /data/firstname as type string (JR: xsd:string bind)", () => {
    const form = parseForm(FORM2_XML);
    expect(form.bindings.has("/data/firstname")).toBe(true);
    expect(form.bindings.get("/data/firstname")!.dataType).toBe("string");
  });

  it("form2.xml binds /data/age as type int (JR: xsd:int bind)", () => {
    const form = parseForm(FORM2_XML);
    expect(form.bindings.get("/data/age")!.dataType).toBe("int");
  });

  it("form2.xml applies bind to instance: /data/age has typed int value 10 (JR: applyBindings)", () => {
    const form = parseForm(FORM2_XML);
    const ref = parseAbsoluteRef("/data/age");
    const node = resolveReference(form.mainInstance, ref);
    expect(node).not.toBeNull();
    expect(node!.dataType).toBe("int");
    expect(node!.value?.kind).toBe("int");
    expect(node!.value?.value).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Inline-form equivalence: basic Scenario.init + answerOf (JR: Scenario-based tests)
// ---------------------------------------------------------------------------

describe("JR equivalence: Scenario.init + answerOf (inline form)", () => {
  it("parses a form with geopoint type and accepts geopoint answer", () => {
    const scenario = Scenario.init(
      html(
        head(
          model(
            mainInstance(t('data id="geo"', t("q1"))),
            bind("/data/q1").type("geopoint")
          )
        ),
        body(input("/data/q1"))
      )
    );
    scenario.answer("/data/q1", "1.234 5.678 0 0");
    const ans = scenario.answerOf("/data/q1");
    expect(ans).not.toBeNull();
    expect(ans!.kind).toBe("geopoint");
  });

  it("parses form with decimal type; initial value parsed as decimal (JR: applyBindings decimal)", () => {
    const scenario = Scenario.init(
      html(
        head(
          model(
            mainInstance(t('data id="dec"', t("score", "1.0"))),
            bind("/data/score").type("decimal")
          )
        ),
        body(input("/data/score"))
      )
    );
    const ans = scenario.answerOf("/data/score");
    expect(ans).not.toBeNull();
    expect(ans!.kind).toBe("decimal");
    // JR: DecimalData.getDisplayText() → String.valueOf(1.0) → "1.0"
    expect(ans!.displayText).toBe("1.0");
  });
});

// ---------------------------------------------------------------------------
// it.fails: tests requiring DAG / navigation / serialization / Phase 2+
// ---------------------------------------------------------------------------

describe("JR equivalence: XFormParserTest — Phase 2+ (it.fails)", () => {
  it.fails("spacesBetweenOutputs_areRespected — requires form navigation/getLabelInnerText (Phase 2)", () => {
    // JR: scenario.next(); scenario.getQuestionAtIndex().getLabelInnerText()
    // Needs form index navigation which is not implemented in Phase 1.
    throw new Error("Phase 2: form index navigation not implemented");
  });

  it.fails("parsesSecondaryInstanceForm — secondary instance support (Phase 2+)", () => {
    throw new Error("Phase 2+: secondary instances not implemented");
  });

  it.fails("parsesLastSavedInstanceWithNullSrc — jr:// reference manager (Phase 2+)", () => {
    throw new Error("Phase 2+: jr:// ReferenceManager not implemented");
  });

  it.fails("parsesLastSavedInstanceWithFilledForm — jr:// reference + last-saved (Phase 2+)", () => {
    throw new Error("Phase 2+: last-saved instance not implemented");
  });

  it.fails("multipleInstancesFormSavesAndRestores — serialization (Phase 3)", () => {
    throw new Error("Phase 3: form serialization/deserialization not implemented");
  });

  it.fails("rangeFormSavesAndRestores — range control + serialization (Phase 3)", () => {
    throw new Error("Phase 3: range form serialization not implemented");
  });

  it.fails("parsesRankForm — rank control type (Phase 2)", () => {
    throw new Error("Phase 2: rank control type not implemented");
  });

  it.fails("parseFormWithTemplateRepeat — repeat template + DAG (Phase 2)", () => {
    throw new Error("Phase 2: repeat template + DAG not implemented");
  });

  it.fails("parseFormWithSetValueAction — setvalue action + DAG (Phase 2)", () => {
    throw new Error("Phase 2: setvalue action not implemented");
  });

  it.fails("parseFormWithBodyBeforeModel — form order validation (Phase 2)", () => {
    throw new Error("Phase 2: body-before-model error detection not implemented");
  });
});
