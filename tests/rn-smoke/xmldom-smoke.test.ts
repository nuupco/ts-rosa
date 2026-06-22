/**
 * RN/Hermes XML smoke test — Node proxy via @xmldom/xmldom.
 *
 * PURPOSE: Validate that @xmldom/xmldom is viable as an XmlParser provider
 * in a Node environment (same parse path used under Hermes/React Native).
 *
 * LIMITATION: This test runs in Node with xmldom. The REAL Hermes/RN
 * validation requires a React Native runtime (device or emulator) and is
 * NOT covered here. Full Hermes verification remains PENDING until ts-rosa
 * is integrated in a RN project and the test is run with a Hermes JS engine.
 *
 * When that validation runs, the expected behaviour is identical to what
 * this test asserts: parse succeeds, root element name is "root", child
 * element name is "child".
 */

import { describe, it, expect } from "vitest";
import { getXmlParser } from "../../src/platform/XmlParser.ts";

describe("XmlParser seam — xmldom smoke (Node proxy for Hermes/RN)", () => {
  it("parses <root><child/></root> and returns a Document with the correct root element", () => {
    const parser = getXmlParser();
    const doc = parser.parse("<root><child/></root>");

    expect(doc).toBeDefined();
    expect(doc.documentElement).toBeDefined();
    expect(doc.documentElement?.nodeName).toBe("root");
  });

  it("root element has one child element named 'child'", () => {
    const parser = getXmlParser();
    const doc = parser.parse("<root><child/></root>");

    const root = doc.documentElement;
    expect(root).toBeDefined();

    // childNodes includes text nodes; filter to element nodes only
    const children = Array.from(root?.childNodes ?? []).filter(
      (n) => n.nodeType === 1,
    );
    expect(children).toHaveLength(1);
    expect(children[0]?.nodeName).toBe("child");
  });

  it("throws a ParseError for malformed XML (xmldom strict error handling)", () => {
    // @xmldom/xmldom throws a ParseError by default on malformed XML.
    // This is STRICTER than the browser DOMParser (which returns an error
    // document without throwing). The seam does not suppress errors —
    // callers are responsible for error handling.
    const parser = getXmlParser();
    expect(() => parser.parse("<unclosed>")).toThrow();
  });
});
