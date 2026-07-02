import { describe, expect, it } from "vitest";
import { registerXmlParser, type XmlParser } from "../../../src/platform/XmlParser.ts";
import { evaluateXPath } from "../../../src/xpath/seam/XPathSeam.ts";

describe("XmlParser platform seam — createDocument()", () => {
  it("accepts an optional createDocument(rootTagName) on the XmlParser interface", () => {
    const provider: XmlParser = {
      parse(xml: string): Document {
        return new DOMParser().parseFromString(xml, "text/xml");
      },
      createDocument(rootTagName: string): Document {
        return document.implementation.createDocument(null, rootTagName, null);
      },
    };

    expect(typeof provider.createDocument).toBe("function");
  });

  it("XPathSeam.getStubDocument() throws a clear error when the registered provider does not implement createDocument", () => {
    registerXmlParser({
      parse(xml: string): Document {
        return new DOMParser().parseFromString(xml, "text/xml");
      },
      // No createDocument implemented.
    });

    expect(() => evaluateXPath("1 + 1")).toThrow(/createDocument/);
  });
});
