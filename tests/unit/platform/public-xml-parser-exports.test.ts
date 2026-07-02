import { describe, expect, it } from "vitest";
import * as pkg from "../../../src/index.ts";

describe("public barrel — XmlParser registration API", () => {
  it("re-exports registerXmlParser and getXmlParser from the package root", () => {
    expect(typeof pkg.registerXmlParser).toBe("function");
    expect(typeof pkg.getXmlParser).toBe("function");
  });

  it("getXmlParser returns whatever was registered via the barrel export", () => {
    const provider = {
      parse(xml: string): Document {
        return new DOMParser().parseFromString(xml, "text/xml");
      },
    };
    pkg.registerXmlParser(provider);
    expect(pkg.getXmlParser()).toBe(provider);
  });
});
