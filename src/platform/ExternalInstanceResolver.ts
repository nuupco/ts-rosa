/**
 * ExternalInstanceResolver — environment-injection seam for `jr://` external
 * secondary instance sources.
 *
 * The core engine never fetches files or network resources directly to
 * resolve `<instance id="..." src="jr://...">` declarations. Instead it
 * retrieves the active provider via `getExternalInstanceResolver()`. Hosts
 * (and the test environment) register their own provider via
 * `registerExternalInstanceResolver()` before calling `resolveExternalInstances`.
 *
 * Mirrors the `XmlParser` seam convention exactly (see `./XmlParser.ts`).
 */

/**
 * Minimal external instance resolver seam.
 * Implementations must return the raw UTF-8 text content for a given `jr://`
 * (or other scheme) URI, or `null` when there is no content available for
 * that URI (e.g. `jr://instance/last-saved` with no prior submission). The
 * engine owns all content-format parsing (e.g. CSV); the resolver only
 * fetches bytes/text. Interpretation of a `null` result is the
 * responsibility of the calling dispatch logic, not this seam.
 */
export interface ExternalInstanceResolver {
  resolve(uri: string): Promise<string | null>;
}

/** Module-level provider slot. Starts unregistered. */
let _provider: ExternalInstanceResolver | null = null;

/**
 * Register the active ExternalInstanceResolver provider.
 * Call this once during environment bootstrap (setupFiles, app init, etc.)
 * before any code that calls `getExternalInstanceResolver()`.
 */
export function registerExternalInstanceResolver(provider: ExternalInstanceResolver): void {
  _provider = provider;
}

/**
 * Retrieve the registered ExternalInstanceResolver provider.
 * Throws if no provider has been registered, making misconfiguration
 * immediately visible rather than producing a silent null-deref.
 */
export function getExternalInstanceResolver(): ExternalInstanceResolver {
  if (_provider === null) {
    throw new Error(
      "ExternalInstanceResolver provider is not registered. " +
        "Call registerExternalInstanceResolver() before resolving external instances. " +
        "In tests, wire the provider in tests/setup.ts via setupFiles.",
    );
  }
  return _provider;
}
