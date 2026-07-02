/**
 * XmlParser — environment-injection seam.
 *
 * The core engine never calls `new DOMParser()` directly. Instead it
 * retrieves the active provider via `getXmlParser()`. Test and RN
 * environments register their own provider via `registerXmlParser()`
 * before any parse call is made (typically in Vitest setupFiles or the
 * RN app bootstrap).
 *
 * Design constraint (from architecture decision record):
 *   - `src/` MUST NOT import Node globals, browser globals, or
 *     `@xmldom/xmldom` directly. Those belong in platform adapters
 *     under `tests/` or an `adapters/` package.
 *   - The `Document` type here is the structural DOM Document interface
 *     (part of the "DOM" lib in tsconfig), not a concrete implementation.
 */

/**
 * Minimal XML parser seam.
 * Implementations must return a DOM-compatible Document for well-formed XML.
 */
export interface XmlParser {
  parse(xml: string): Document;
  /**
   * Optional stub-document factory.
   *
   * Some engine internals (e.g. the XPath seam) need a minimal, valid DOM
   * Document to use as a context node when no real instance is available.
   * Providers that back the engine in an environment where XPath evaluation
   * happens (tests, RN bootstrap) MUST implement this; providers that only
   * ever parse real XML (rare) may omit it, in which case callers relying on
   * the stub document will get a clear, actionable error.
   */
  createDocument?(rootTagName: string): Document;
}

/** Module-level provider slot. Starts unregistered. */
let _provider: XmlParser | null = null;

/**
 * Register the active XmlParser provider.
 * Call this once during environment bootstrap (setupFiles, app init, etc.)
 * before any code that calls `getXmlParser()`.
 */
export function registerXmlParser(provider: XmlParser): void {
  _provider = provider;
}

/**
 * Retrieve the registered XmlParser provider.
 * Throws if no provider has been registered, making misconfiguration
 * immediately visible rather than producing a silent null-deref.
 */
export function getXmlParser(): XmlParser {
  if (_provider === null) {
    throw new Error(
      "XmlParser provider is not registered. " +
        "Call registerXmlParser() before parsing XML. " +
        "In tests, wire the provider in tests/setup.ts via setupFiles.",
    );
  }
  return _provider;
}
