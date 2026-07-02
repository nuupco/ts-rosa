/**
 * PlatformConfig — environment-injection seam for platform-level configuration.
 *
 * Currently exposes `timeZoneId`, used by the vendored XPath `Evaluator`
 * instances for date/time-dependent evaluation. `Temporal.Now.timeZoneId()`
 * requires `Intl`, which is unavailable on Hermes; ts-rosa always supplies an
 * explicit value (default `'UTC'`) so that fallback path is never reached on
 * the shipped path, while remaining behavior-compatible with existing
 * JavaRosa oracle tests (which assume UTC).
 */

export interface PlatformConfig {
  /**
   * IANA time zone identifier (e.g. "America/Mexico_City") used by
   * date/time-dependent XPath evaluation. Defaults to "UTC".
   */
  readonly timeZoneId?: string;
}

const DEFAULT_TIME_ZONE_ID = "UTC";

let _timeZoneId: string = DEFAULT_TIME_ZONE_ID;

/**
 * Register platform configuration. Call this once during environment
 * bootstrap, before any XPath evaluation occurs, so lazily constructed
 * evaluator singletons pick up the configured values on first use.
 */
export function registerPlatformConfig(config: PlatformConfig): void {
  _timeZoneId = config.timeZoneId ?? DEFAULT_TIME_ZONE_ID;
}

/**
 * Retrieve the configured time zone identifier. Defaults to "UTC" when no
 * configuration has been registered.
 */
export function getPlatformTimeZoneId(): string {
  return _timeZoneId;
}
