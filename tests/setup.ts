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

import { DOMImplementation, DOMParser } from "@xmldom/xmldom";
import { registerXmlParser } from "../src/platform/XmlParser.ts";
import { registerExternalInstanceResolver } from "../src/platform/ExternalInstanceResolver.ts";

registerXmlParser({
  parse(xml: string): Document {
    return new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;
  },
  createDocument(rootTagName: string): Document {
    const impl = new DOMImplementation();
    return impl.createDocument(null, rootTagName, null) as unknown as Document;
  },
});

/**
 * ExternalInstanceResolver test provider.
 *
 * Default behavior throws — most tests never reach hydration and this makes
 * a missing test-specific fixture fail loudly and clearly rather than
 * silently returning empty/garbage content. Tests that exercise
 * `resolveExternalInstances` (PR3) register their own resolver per-test via
 * `registerExternalInstanceResolver()` before calling it.
 */
registerExternalInstanceResolver({
  resolve(uri: string): Promise<string> {
    return Promise.reject(
      new Error(
        `Test ExternalInstanceResolver has no fixture registered for '${uri}'. ` +
          "Call registerExternalInstanceResolver() in your test to provide one.",
      ),
    );
  },
});
