/**
 * Equivalence: XPath path expressions over a real xmldom DOM (Slice 4)
 *
 * Source oracle:
 *   reference/javarosa/src/test/java/org/javarosa/xpath/test/XPathEvalTest.java
 *   (node_referencing, count/position tests with live instance)
 *
 * These tests supply a minimal xmldom document as EvaluationContext so that
 * path expressions, axis steps, and nodeset functions exercise the real
 * XmldomXPathAdapter traversal rather than the stub document.
 *
 * Tests that require FormInstance / InstanceTree bridge stay as it.fails()
 * with an explicit "Phase 3: InstanceTree bridge" annotation.
 */

import { describe, it, expect } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { evaluateXPath, type EvaluationContext } from "../../../src/xpath/index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml");
}

/**
 * Build an EvaluationContext with the document root as both instance and
 * contextNode, unless a specific contextNode is provided.
 */
function ctx(doc: Document, contextNode?: Node): EvaluationContext {
  return {
    instance: doc as unknown as import("@xmldom/xmldom").Node,
    contextNode: (contextNode ?? doc) as unknown as import("@xmldom/xmldom").Node,
  };
}

// ---------------------------------------------------------------------------
// Absolute path expressions
// Source: XPathEvalTest.java node_referencing()
// ---------------------------------------------------------------------------
describe("XPath path — absolute path selects nodes", () => {
  const doc = parseXml("<root><a>hello</a><b>world</b></root>");

  it("count(/root/a) → 1", () => {
    expect(evaluateXPath("count(/root/a)", ctx(doc))).toBe(1);
  });

  it("count(/root/b) → 1", () => {
    expect(evaluateXPath("count(/root/b)", ctx(doc))).toBe(1);
  });

  it("/root/a returns nodeset of 1 node", () => {
    const result = evaluateXPath("/root/a", ctx(doc));
    expect(Array.isArray(result)).toBe(true);
    expect((result as Node[]).length).toBe(1);
  });

  it("string(/root/a) → 'hello'", () => {
    expect(evaluateXPath("string(/root/a)", ctx(doc))).toBe("hello");
  });

  it("string(/root/b) → 'world'", () => {
    expect(evaluateXPath("string(/root/b)", ctx(doc))).toBe("world");
  });
});

// ---------------------------------------------------------------------------
// count() over child axis
// ---------------------------------------------------------------------------
describe("XPath path — count() over child axis", () => {
  const doc = parseXml("<group><item>a</item><item>b</item><item>c</item></group>");
  const root = doc.documentElement!;

  it("count(item) from root context → 3", () => {
    expect(evaluateXPath("count(item)", ctx(doc, root))).toBe(3);
  });

  it("count(/group/item) absolute → 3", () => {
    expect(evaluateXPath("count(/group/item)", ctx(doc))).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Relative path expressions with context node
// ---------------------------------------------------------------------------
describe("XPath path — relative path from context element", () => {
  const doc = parseXml("<data><meta><deviceid>abc</deviceid></meta></data>");
  const dataEl = doc.documentElement!;

  it("meta/deviceid from data context → nodeset of 1", () => {
    const result = evaluateXPath("meta/deviceid", ctx(doc, dataEl));
    expect(Array.isArray(result)).toBe(true);
    expect((result as Node[]).length).toBe(1);
  });

  it("string(meta/deviceid) from data context → 'abc'", () => {
    expect(evaluateXPath("string(meta/deviceid)", ctx(doc, dataEl))).toBe("abc");
  });
});

// ---------------------------------------------------------------------------
// Predicate / position()
// ---------------------------------------------------------------------------
describe("XPath path — predicate with position()", () => {
  const doc = parseXml("<list><x>one</x><x>two</x><x>three</x></list>");
  const listEl = doc.documentElement!;

  it("x[1] returns first element", () => {
    const result = evaluateXPath("x[1]", ctx(doc, listEl));
    expect(Array.isArray(result)).toBe(true);
    expect((result as Node[]).length).toBe(1);
  });

  it("string(x[2]) → 'two'", () => {
    expect(evaluateXPath("string(x[2])", ctx(doc, listEl))).toBe("two");
  });

  it("string(x[3]) → 'three'", () => {
    expect(evaluateXPath("string(x[3])", ctx(doc, listEl))).toBe("three");
  });

  it("count(x[position()=2]) → 1", () => {
    expect(evaluateXPath("count(x[position()=2])", ctx(doc, listEl))).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// last() function
// ---------------------------------------------------------------------------
describe("XPath path — last()", () => {
  const doc = parseXml("<root><n>1</n><n>2</n><n>3</n></root>");
  const rootEl = doc.documentElement!;

  it("count(n[last()]) → 1", () => {
    expect(evaluateXPath("count(n[last()])", ctx(doc, rootEl))).toBe(1);
  });

  it("string(n[last()]) → '3'", () => {
    expect(evaluateXPath("string(n[last()])", ctx(doc, rootEl))).toBe("3");
  });
});

// ---------------------------------------------------------------------------
// name() / local-name() on nodes
// ---------------------------------------------------------------------------
describe("XPath path — name() / local-name()", () => {
  const doc = parseXml("<root><foo/></root>");
  const rootEl = doc.documentElement!;

  it("name(/root) → 'root'", () => {
    expect(evaluateXPath("name(/root)", ctx(doc))).toBe("root");
  });

  it("local-name(/root/foo) → 'foo'", () => {
    expect(evaluateXPath("local-name(/root/foo)", ctx(doc))).toBe("foo");
  });

  it("name(foo) relative from root context → 'foo'", () => {
    expect(evaluateXPath("name(foo)", ctx(doc, rootEl))).toBe("foo");
  });
});

// ---------------------------------------------------------------------------
// Predicate with value comparison
// ---------------------------------------------------------------------------
describe("XPath path — predicate with value comparison", () => {
  const doc = parseXml(
    "<data><field id='a'>yes</field><field id='b'>no</field></data>"
  );
  const dataEl = doc.documentElement!;

  it("count(field[@id='a']) → 1", () => {
    expect(evaluateXPath("count(field[@id='a'])", ctx(doc, dataEl))).toBe(1);
  });

  it("string(field[@id='b']) → 'no'", () => {
    expect(evaluateXPath("string(field[@id='b'])", ctx(doc, dataEl))).toBe("no");
  });
});

// ---------------------------------------------------------------------------
// Wildcard axis
// ---------------------------------------------------------------------------
describe("XPath path — wildcard child axis", () => {
  const doc = parseXml("<root><a/><b/><c/></root>");
  const rootEl = doc.documentElement!;

  it("count(*) from root → 3", () => {
    expect(evaluateXPath("count(*)", ctx(doc, rootEl))).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Backlog — tests requiring FormInstance / InstanceTree bridge
// These remain it.fails() per spec (Phase 3: InstanceTree bridge)
// ---------------------------------------------------------------------------
describe("XPath path — backlog (Phase 3: InstanceTree bridge)", () => {
  it.fails(
    "indexed-repeat: /data/repeat/name[indexed-repeat index] requires live instance",
    () => {
      // Phase 3: InstanceTree bridge — indexed-repeat needs a live FormInstance
      // with repeat-group traversal wired through TreeReference/InstanceTree.
      // Cannot be tested against a bare xmldom document.
      throw new Error("Phase 3: InstanceTree bridge not yet implemented");
    }
  );
});
