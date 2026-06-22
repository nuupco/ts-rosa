/**
 * Vitest global setup — registers environment providers before any test runs.
 *
 * XmlParser provider: @xmldom/xmldom
 *   Wraps xmldom's DOMParser behind the XmlParser seam so no test or src
 *   file ever calls `new DOMParser()` directly.
 *
 *   This is the SINGLE sanctioned `new DOMParser()` call site: the provider
 *   boundary itself. A repo-wide grep will match here by design — that is the
 *   one allowed match, not a leak of the seam into harness or engine code.
 *
 * NOTE: This file is intentionally in tests/ (not src/) because the
 * @xmldom/xmldom dependency is a devDependency and must never be bundled
 * into the production src/ output.
 */

import { DOMParser } from "@xmldom/xmldom";
import { registerXmlParser } from "../src/platform/XmlParser.ts";

registerXmlParser({
  parse(xml: string): Document {
    return new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;
  },
});
