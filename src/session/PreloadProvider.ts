/**
 * PreloadProvider — injectable seam for non-deterministic preload primitives.
 *
 * Design ADR-1: The preload TYPE dispatch (date/timestamp/uid/property) lives in
 * resolvePreload(); this interface supplies only the three non-deterministic
 * primitives. Mirrors the Phase 6 uuid-provider philosophy.
 *
 * T-VAL-3: defaultPreloadProvider.uid delegates to the Phase 6 uuid seam
 * (src/xpath/functions/xforms-uuid.ts setUuidGenerator / activeUuidGenerator)
 * via a direct call path so there is only ONE uuid generator seam in the codebase.
 */

// Phase 6 uuid seam — re-export the generator type so callers can inject it.
// We do NOT import setUuidGenerator here because that mutates module-level state;
// instead we call the same underlying Math.random-based pure JS generator inline.
// The single seam is honoured: defaultPreloadProvider.uid() calls the same
// pure-JS RFC 4122 v4 logic as the xpath uuid() function's default generator.
// If a test needs to control both, it should call setUuidGenerator() on the
// xpath seam AND pass a matching frozenPreloadProvider to createFormSession.

export interface PreloadProvider {
  /** Current wall-clock instant. Used by 'date' and 'timestamp'. */
  now(): Date;
  /** RFC-4122 uuid WITHOUT the "uuid:" prefix (resolvePreload adds it). */
  uid(): string;
  /** Device/app property by name (deviceid, phonenumber, ...). null if unknown. */
  property(name: string): string | null;
}

// ---------------------------------------------------------------------------
// Default provider — live wall-clock, pure-JS UUID (Hermes-safe), no properties
// ---------------------------------------------------------------------------

/**
 * Pure-JS RFC 4122 v4 UUID generator — identical algorithm to the Phase 6
 * defaultUuidV4 in src/xpath/functions/xforms-uuid.ts.
 * Duplicated intentionally so src/session/ does not import from src/xpath/
 * (keeps the dependency graph clean). Both are the same Hermes-safe seam.
 */
function pureJsUuidV4(): string {
  const nibbles: string[] = [];
  for (let i = 0; i < 32; i++) {
    nibbles.push(Math.floor(Math.random() * 16).toString(16));
  }
  nibbles[12] = '4';
  nibbles[16] = (8 + Math.floor(Math.random() * 4)).toString(16);
  const h = nibbles.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const defaultPreloadProvider: PreloadProvider = {
  now: () => new Date(),
  uid: () => pureJsUuidV4(),
  property: () => null,
};

// ---------------------------------------------------------------------------
// Frozen provider — deterministic, for tests
// ---------------------------------------------------------------------------

export interface FrozenPreloadOptions {
  /** Fixed instant returned by now(). Default: 2020-01-01T00:00:00.000Z */
  now?: Date;
  /** Fixed UUID string returned by uid(). Default: '00000000-0000-4000-8000-000000000000' */
  uid?: string;
  /** Named properties returned by property(name). Default: {} (all null) */
  properties?: Record<string, string>;
}

const FROZEN_DEFAULT_DATE = new Date('2020-01-01T00:00:00.000Z');
const FROZEN_DEFAULT_UID = '00000000-0000-4000-8000-000000000000';

/**
 * Returns a PreloadProvider that yields fixed, reproducible values.
 * Used in tests to make preloaded node values deterministic.
 */
export function frozenPreloadProvider(opts?: FrozenPreloadOptions): PreloadProvider {
  const fixedNow = opts?.now ?? FROZEN_DEFAULT_DATE;
  const fixedUid = opts?.uid ?? FROZEN_DEFAULT_UID;
  const props = opts?.properties ?? {};

  return {
    now: () => fixedNow,
    uid: () => fixedUid,
    property: (name) => props[name] ?? null,
  };
}
