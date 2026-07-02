/**
 * Published-entry-point E2E test (Phase 6, packaging-shipping-fix).
 *
 * Exercises parse → session → answer → serialize using ONLY the package's
 * public exports, resolved through the `@nuup/ts-rosa` package name (aliased
 * to `dist/index.js` by vitest.e2e.config.ts — the same `exports`-based
 * resolution a real consumer gets). No deep `src/` imports are used here.
 *
 * This is a regression guard for the packaging contract (spec: Published
 * Entry Point E2E Coverage): if a future change drops `registerXmlParser`/
 * `getXmlParser` from the public barrel, this test fails.
 */
import { describe, expect, it } from "vitest";
import { DOMImplementation, DOMParser } from "@xmldom/xmldom";
import {
  registerXmlParser,
  parseForm,
  createFormSession,
  FormEvaluator,
  parseAbsoluteRef,
  cast,
} from "@nuup/ts-rosa";

registerXmlParser({
  parse(xml: string): Document {
    return new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;
  },
  createDocument(rootTagName: string): Document {
    const impl = new DOMImplementation();
    return impl.createDocument(null, rootTagName, null) as unknown as Document;
  },
});

const FORM_XML = `<h:html xmlns="http://www.w3.org/2002/xforms"
        xmlns:h="http://www.w3.org/1999/xhtml">
  <h:head>
    <h:title>E2E Form</h:title>
    <model>
      <instance>
        <data id="e2e-form">
          <name/>
        </data>
      </instance>
      <bind nodeset="/data/name" type="string"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/name">
      <label>Name</label>
    </input>
  </h:body>
</h:html>`;

describe("published package consumption (dist/)", () => {
  it("parses a form, creates a session, answers a question, and serializes the result", () => {
    const definition = parseForm(FORM_XML);
    const session = createFormSession(definition);

    const ref = parseAbsoluteRef("/data/name");
    const result = session.evaluator.answerQuestion(ref, cast("string", "Ada Lovelace"));

    expect(result).toBeDefined();

    const xml = session.serializeToXml();
    expect(xml).toContain("Ada Lovelace");
  });

  it("re-exports registerXmlParser/getXmlParser from the public barrel", async () => {
    const { getXmlParser } = await import("@nuup/ts-rosa");
    expect(typeof getXmlParser).toBe("function");
    expect(typeof registerXmlParser).toBe("function");
    expect(() => getXmlParser()).not.toThrow();
  });
});
