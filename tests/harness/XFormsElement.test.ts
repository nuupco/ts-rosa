import { describe, it, expect } from "vitest";
import { getXmlParser } from "../../src/platform/XmlParser.ts";
import {
  html,
  head,
  body,
  model,
  mainInstance,
  instance,
  bind,
  input,
  select1,
  select,
  repeat,
  group,
  label,
  item,
  t,
  setvalue,
  title,
} from "../../tests/harness/XFormsElement.ts";

// Helper: parse XML and assert no parser error.
// Uses the injected XmlParser seam (registered in tests/setup.ts) instead of
// calling `new DOMParser()` directly — this satisfies the "no hardcoded
// DOMParser" constraint from the spec.
function parseXml(xml: string): Document {
  const doc = getXmlParser().parse(xml);
  const errors = doc.getElementsByTagName("parsererror");
  expect(errors.length, `XML parse error in:\n${xml}`).toBe(0);
  return doc;
}

describe("XFormsElement — Scenario: simple model round-trip", () => {
  it("produces parseable XML for a minimal form", () => {
    const form = html(
      head(model(mainInstance(t("data id=\"test\"", t("field"))))),
      body(input("/data/field"))
    );
    const xml = form.asXml();
    expect(typeof xml).toBe("string");
    expect(xml.length).toBeGreaterThan(0);
    const doc = parseXml(xml);
    expect(doc.documentElement?.nodeName).toBe("h:html");
  });

  it("includes the xml declaration", () => {
    const form = html(
      head(model(mainInstance(t("data id=\"test\"")))),
      body()
    );
    expect(form.asXml()).toContain("<?xml version");
  });

  it("root element carries XForms namespaces", () => {
    const form = html(
      head(model(mainInstance(t("data")))),
      body()
    );
    const xml = form.asXml();
    expect(xml).toContain('xmlns="http://www.w3.org/2002/xforms"');
    expect(xml).toContain('xmlns:h="http://www.w3.org/1999/xhtml"');
  });

  it("input ref appears in body output", () => {
    const form = html(
      head(model(mainInstance(t("data", t("q"))))),
      body(input("/data/q"))
    );
    expect(form.asXml()).toContain('ref="/data/q"');
  });
});

describe("XFormsElement — Scenario: bind attribute coverage", () => {
  it("bind emits nodeset attribute", () => {
    const el = bind("/data/q");
    expect(el.asXml()).toContain('nodeset="/data/q"');
  });

  it("bind with type emits type attribute", () => {
    const el = bind("/data/q").type("string");
    expect(el.asXml()).toContain('type="string"');
  });

  it("bind with required emits required attribute", () => {
    const el = bind("/data/q").required("true()");
    expect(el.asXml()).toContain('required="true()"');
  });

  it("bind with constraint emits constraint attribute", () => {
    const el = bind("/data/q").constraint(". > 0");
    expect(el.asXml()).toContain('constraint=". > 0"');
  });

  it("bind with relevant emits relevant attribute", () => {
    const el = bind("/data/q").relevant("/data/flag = '1'");
    expect(el.asXml()).toContain("relevant=");
  });

  it("bind with calculate emits calculate attribute", () => {
    const el = bind("/data/q").calculate("1 + 1");
    expect(el.asXml()).toContain('calculate="1 + 1"');
  });

  it("bind with readonly emits readonly attribute", () => {
    const el = bind("/data/q").readonly();
    expect(el.asXml()).toContain('readonly="true()"');
  });

  it("bind with preload emits jr:preload attribute", () => {
    const el = bind("/data/q").preload("timestamp");
    expect(el.asXml()).toContain('jr:preload="timestamp"');
  });

  it("bind fluent chain accumulates all attributes", () => {
    const el = bind("/data/q")
      .type("string")
      .required("true()")
      .relevant("/data/flag = '1'");
    const xml = el.asXml();
    expect(xml).toContain('type="string"');
    expect(xml).toContain('required="true()"');
    expect(xml).toContain("relevant=");
  });

  it("bind element name is 'bind'", () => {
    const el = bind("/data/q");
    expect(el.getName()).toBe("bind");
  });
});

describe("XFormsElement — Scenario: nested repeat and group", () => {
  it("repeat wrapping group wrapping input preserves nesting order", () => {
    const form = html(
      head(model(mainInstance(t("data", t("rep", t("grp", t("q"))))))),
      body(
        repeat("/data/rep",
          group("/data/rep/grp",
            input("/data/rep/grp/q")
          )
        )
      )
    );
    const xml = form.asXml();
    const repeatIdx = xml.indexOf("<repeat");
    const groupIdx = xml.indexOf("<group");
    const inputIdx = xml.indexOf("<input");
    expect(repeatIdx).toBeLessThan(groupIdx);
    expect(groupIdx).toBeLessThan(inputIdx);
  });

  it("repeat nodeset attribute is present", () => {
    const el = repeat("/data/rep", input("/data/rep/q"));
    expect(el.asXml()).toContain('nodeset="/data/rep"');
  });

  it("group ref attribute is present", () => {
    const el = group("/data/grp", input("/data/grp/q"));
    expect(el.asXml()).toContain('ref="/data/grp"');
  });
});

describe("XFormsElement — additional helpers", () => {
  it("t() with no children produces self-closing tag", () => {
    const xml = t("foo").asXml();
    expect(xml).toBe("<foo/>");
  });

  it("t() with string inner produces text content", () => {
    const xml = t("foo", "bar").asXml();
    expect(xml).toBe("<foo>bar</foo>");
  });

  it("t() with attributes parses them from name string", () => {
    const xml = t('foo bar="baz"').asXml();
    expect(xml).toContain('bar="baz"');
  });

  it("t() with child elements wraps them", () => {
    const xml = t("outer", t("inner")).asXml();
    expect(xml).toContain("<inner/>");
  });

  it("label produces label element with inner text", () => {
    const xml = label("My Label").asXml();
    expect(xml).toBe("<label>My Label</label>");
  });

  it("item produces item with label and value children", () => {
    const xml = item("1", "Option A").asXml();
    expect(xml).toContain("<label>Option A</label>");
    expect(xml).toContain("<value>1</value>");
  });

  it("item with numeric value converts to string", () => {
    const xml = item(42, "Forty Two").asXml();
    expect(xml).toContain("<value>42</value>");
  });

  it("select1 carries ref attribute", () => {
    const xml = select1("/data/q", item("1", "A")).asXml();
    expect(xml).toContain('ref="/data/q"');
    expect(xml).toContain("<select1");
  });

  it("select carries ref attribute", () => {
    const xml = select("/data/q", item("1", "A")).asXml();
    expect(xml).toContain('ref="/data/q"');
    expect(xml).toContain("<select");
  });

  it("setvalue with event+ref+value emits all attributes", () => {
    const xml = setvalue("xforms-ready", "/data/q", "1").asXml();
    expect(xml).toContain('event="xforms-ready"');
    expect(xml).toContain('ref="/data/q"');
    expect(xml).toContain('value="1"');
  });

  it("setvalue without value omits value attribute", () => {
    const xml = setvalue("xforms-ready", "/data/q").asXml();
    expect(xml).toContain('event="xforms-ready"');
    expect(xml).not.toContain('value="');
  });

  it("title produces h:title with inner text", () => {
    const xml = title("My Form").asXml();
    expect(xml).toBe("<h:title>My Form</h:title>");
  });

  it("instance carries id attribute", () => {
    const xml = instance("mylist", t("item1")).asXml();
    expect(xml).toContain('id="mylist"');
  });

  it("mainInstance wraps children without id", () => {
    const xml = mainInstance(t("data")).asXml();
    expect(xml).toContain("<instance>");
    expect(xml).not.toContain('id="');
  });
});

describe("XFormsElement — round-trip parseability (all helpers)", () => {
  it("a full form round-trips through xmldom without errors", () => {
    const form = html(
      head(
        title("Test Form"),
        model(
          mainInstance(
            t('data id="test"',
              t("q1"),
              t("rep", t("q2"))
            )
          ),
          bind("/data/q1").type("string").required("true()"),
          bind("/data/rep/q2").type("int")
        )
      ),
      body(
        input("/data/q1", label("Question 1")),
        repeat("/data/rep",
          input("/data/rep/q2", label("Q2"))
        )
      )
    );
    const xml = form.asXml();
    parseXml(xml);
  });
});
