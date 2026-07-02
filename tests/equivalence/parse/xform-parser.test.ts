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
import { html, head, body, model, mainInstance, bind, input, t, setvalue, repeat } from "../../harness/XFormsElement.ts";
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
  it(
    // Ported from org.javarosa.xform.parse.XFormParserTest#spacesBetweenOutputs_areRespected
    // Source: org.javarosa.xform.parse.XFormParserTest#spacesBetweenOutputs_areRespected
    //
    // JR: scenario.next(); scenario.getQuestionAtIndex().getLabelInnerText()
    // Returns "Full name: ${0}<nbsp>${1}" where <output> elements become ${index} placeholders.
    "spacesBetweenOutputs_areRespected",
    () => {
      // Raw XML mirrors the JavaRosa fixture: label with adjacent <output> elements
      // separated by a non-breaking space ( ).
      const formXml = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml">
  <h:head>
    <h:title>Spaces Between Outputs</h:title>
    <model>
      <instance>
        <data id="spaces-outputs">
          <first_name/>
          <last_name/>
          <question/>
        </data>
      </instance>
      <bind nodeset="/data/question" type="string"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/question">
      <label>Full name: <output value=" ../first_name "/> <output value=" ../last_name "/></label>
    </input>
  </h:body>
</h:html>`;
      const scenario = Scenario.init(formXml);
      scenario.next();
      const question = scenario.getQuestionAtIndex();
      const nbsp = " ";
      const expected = `Full name: \${0}${nbsp}\${1}`;
      expect(question!.getLabelInnerText()).toBe(expected);
    },
  );

  // Promoted from it.fails in Phase 5 slice 5b (commit 1361c42).
  // JR: XFormParserTest#parsesSecondaryInstanceForm — only checks title.
  // Fixture inlined from reference/javarosa/src/test/resources/org/javarosa/xform/parse/secondary-instance.xml
  it("parsesSecondaryInstanceForm — parses form with internal secondary instance", () => {
    const secondaryInstanceXml = `<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml">
    <h:head>
        <h:title>Form with secondary instance</h:title>
        <model>
            <instance>
                <data id="a">
                    <data_set_used/>
                </data>
            </instance>
            <instance id="towns">
                <towndata z="1">
                    <data_set>us_east</data_set>
                </towndata>
            </instance>
            <bind nodeset="/data/data_set_used" calculate="instance('towns')/towndata/data_set"/>
        </model>
    </h:head>
    <h:body></h:body>
</h:html>`;
    const form = parseForm(secondaryInstanceXml);
    expect(form.title).toBe("Form with secondary instance");
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

  it.fails("parseFormWithBodyBeforeModel — form order validation (Phase 2)", () => {
    throw new Error("Phase 2: body-before-model error detection not implemented");
  });
});

// ---------------------------------------------------------------------------
// setvalue action parsing (parser + FormDefinition.actions field — parsing only,
// no ActionRegistry/firing yet; see sdd/setvalue-actions design + tasks)
// ---------------------------------------------------------------------------

describe("setvalue action parsing", () => {
  it("parseFormWithSetValueAction — model-level setvalue is recorded on FormDefinition.actions (JR: it.fails promoted)", () => {
    const def = parseForm(
      html(
        head(
          model(
            mainInstance(t('data id="sv"', t("a"))),
            bind("/data/a").type("string"),
            setvalue("odk-instance-first-load", "/data/a", "'x'")
          )
        ),
        body(input("/data/a"))
      ).asXml()
    );
    expect(def.actions).toHaveLength(1);
    const action = def.actions[0]!;
    expect(action.event).toBe("odk-instance-first-load");
    expect(action.target.levels.map((l) => l.name)).toEqual(["data", "a"]);
    expect(action.expr).not.toBeNull();
    expect(action.literal).toBeNull();
  });

  it("normalizes 'xforms-ready' event alias to 'odk-instance-first-load'", () => {
    const def = parseForm(
      html(
        head(
          model(
            mainInstance(t('data id="svalias"', t("a"))),
            bind("/data/a").type("string"),
            setvalue("xforms-ready", "/data/a", "'x'")
          )
        ),
        body(input("/data/a"))
      ).asXml()
    );
    expect(def.actions).toHaveLength(1);
    expect(def.actions[0]!.event).toBe("odk-instance-first-load");
  });

  it("body-nested setvalue with inner-text literal (no value attribute) is recorded", () => {
    const def = parseForm(
      html(
        head(
          model(
            mainInstance(t('data id="svlit"', t("a"), t("b"))),
            bind("/data/a").type("string"),
            bind("/data/b").type("string")
          )
        ),
        body(
          input(
            "/data/a",
            t('setvalue event="xforms-value-changed" ref="/data/b"', "literal-value")
          )
        )
      ).asXml()
    );
    expect(def.actions).toHaveLength(1);
    const action = def.actions[0]!;
    expect(action.event).toBe("xforms-value-changed");
    expect(action.expr).toBeNull();
    expect(action.literal).toBe("literal-value");
    // trigger set includes the host control's ref (/data/a) per design's union rule
    const triggerNames = action.triggers.map((r) => r.levels.map((l) => l.name).join("/"));
    expect(triggerNames).toContain("data/a");
  });

  it("collects both model-level and body-nested setvalue actions together", () => {
    const def = parseForm(
      html(
        head(
          model(
            mainInstance(t('data id="svboth"', t("a"), t("b"))),
            bind("/data/a").type("string"),
            bind("/data/b").type("string"),
            setvalue("odk-instance-first-load", "/data/a", "'x'")
          )
        ),
        body(input("/data/b", setvalue("xforms-value-changed", "/data/a", "/data/b")))
      ).asXml()
    );
    expect(def.actions).toHaveLength(2);
    const events = def.actions.map((a) => a.event).sort();
    expect(events).toEqual(["odk-instance-first-load", "xforms-value-changed"]);
  });
});

describe("setvalue action parsing: host-relative ref resolution", () => {
  it("resolves a bare relative ref nested in a group as a child of the group's own node (not the group's parent)", () => {
    const def = parseForm(
      html(
        head(
          model(
            mainInstance(t('data id="svhostrel"', t("g", t("a"), t("b")))),
            bind("/data/g/a").type("string"),
            bind("/data/g/b").type("string")
          )
        ),
        body(
          t(
            'group ref="/data/g"',
            input("/data/g/a"),
            t('setvalue event="xforms-value-changed" ref="b" value="1"')
          )
        )
      ).asXml()
    );
    expect(def.actions).toHaveLength(1);
    const target = def.actions[0]!.target;
    const targetPath = target.levels.map((l) => l.name).join("/");
    // Child-of-host resolution: relative ref "b" under host /data/g resolves
    // to /data/g/b, NOT /data/b (sibling-of-host, which would be wrong).
    expect(targetPath).toBe("data/g/b");
  });
});

describe("setvalue action parsing: fail-loud on unsupported event", () => {
  it("throws naming the unsupported event and ref for a single unsupported event", () => {
    const xml = html(
      head(
        model(
          mainInstance(t('data id="svbad"', t("a"))),
          bind("/data/a").type("string"),
          setvalue("odk-new-repeat", "/data/a", "1")
        )
      ),
      body(input("/data/a"))
    ).asXml();
    expect(() => parseForm(xml)).toThrow(/odk-new-repeat/);
    expect(() => parseForm(xml)).toThrow(/\/data\/a/);
  });

  it("throws for another unsupported event token (xforms-revalidate)", () => {
    const xml = html(
      head(
        model(
          mainInstance(t('data id="svbad2"', t("a"))),
          bind("/data/a").type("string"),
          setvalue("xforms-revalidate", "/data/a", "1")
        )
      ),
      body(input("/data/a"))
    ).asXml();
    expect(() => parseForm(xml)).toThrow(/xforms-revalidate/);
  });

  it("throws when the event attribute is missing", () => {
    const xml = html(
      head(
        model(
          mainInstance(t('data id="svnoevt"', t("a"))),
          bind("/data/a").type("string"),
          t('setvalue ref="/data/a" value="1"')
        )
      ),
      body(input("/data/a"))
    ).asXml();
    expect(() => parseForm(xml)).toThrow();
  });

  it("throws when multiple space-separated events include an unsupported one", () => {
    const xml = html(
      head(
        model(
          mainInstance(t('data id="svmulti"', t("a"))),
          bind("/data/a").type("string"),
          t('setvalue event="xforms-value-changed odk-new-repeat" ref="/data/a" value="1"')
        )
      ),
      body(input("/data/a"))
    ).asXml();
    expect(() => parseForm(xml)).toThrow(/odk-new-repeat/);
  });

  it("throws when multiple space-separated events are all individually valid but distinct (fail-loud, not silently picking one)", () => {
    const xml = html(
      head(
        model(
          mainInstance(t('data id="svmultivalid"', t("a"))),
          bind("/data/a").type("string"),
          t('setvalue event="odk-instance-first-load xforms-value-changed" ref="/data/a" value="1"')
        )
      ),
      body(input("/data/a"))
    ).asXml();
    expect(() => parseForm(xml)).toThrow(/multiple events/);
    expect(() => parseForm(xml)).toThrow(/odk-instance-first-load xforms-value-changed/);
  });
});

describe("setvalue action parsing: repeat-relative target rejection (v1 limit)", () => {
  it("throws a clear error for a relative target ref with no host context (model-level)", () => {
    const xml = html(
      head(
        model(
          mainInstance(t('data id="svrel"', t("a"))),
          bind("/data/a").type("string"),
          t('setvalue event="odk-instance-first-load" ref="a" value="1"')
        )
      ),
      body(input("/data/a"))
    ).asXml();
    expect(() => parseForm(xml)).toThrow(/relative target ref/);
  });

  it("throws a clear error for a '..'-navigating (repeat-relative) target ref", () => {
    const xml = html(
      head(
        model(
          mainInstance(t('data id="svrel2"', t("reps", t("item")))),
          bind("/data/reps/item").type("string")
        )
      ),
      body(
        repeat("/data/reps", input("/data/reps/item", t('setvalue event="xforms-value-changed" ref="../item" value="1"')))
      )
    ).asXml();
    expect(() => parseForm(xml)).toThrow(/repeat-relative target ref/);
  });
});
