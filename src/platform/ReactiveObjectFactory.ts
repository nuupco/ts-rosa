/**
 * OpaqueReactiveObjectFactory — Slice 3.5
 *
 * An opaque factory that wraps a plain object into a (potentially reactive)
 * proxy. The default identity factory returns the object unchanged.
 *
 * Framework adapters (Solid, Vue, Zustand, Jotai, …) inject a factory that
 * returns a reactive proxy. Because FormEvaluator MUTATES the returned object
 * in place (state.relevant = x), reactive proxies observe writes transparently.
 *
 * STRUCTURAL-IDENTITY CONTRACT: the factory MUST return an object with the
 * same shape as the input — never a clone with a different field set.
 *
 * Core code never imports any reactive runtime. This seam is the only point
 * of contact between the pure engine and any framework reactivity layer.
 */

export interface OpaqueReactiveObjectFactory {
  <T extends object>(initial: T): T;
}

/**
 * Identity factory — returns the plain object unchanged.
 * This is the default used by the core engine and tests.
 */
export const identityReactiveFactory: OpaqueReactiveObjectFactory = <T extends object>(
  initial: T,
): T => initial;
