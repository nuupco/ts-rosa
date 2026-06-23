/**
 * XPath evaluation seam — PROVISIONAL stub for Phase 2.
 *
 * This module exposes the evaluation surface that Phase 2 will implement.
 * All functions currently throw "not implemented: xpath evaluation (Phase 2)"
 * so that equivalence tests written as it.fails() become red-bar markers
 * that activate automatically once the real engine is wired in.
 *
 * IMPORTANT: The concrete API (parameter shapes, context model, nodeset
 * representation) will be finalized after the @getodk/common fork+adapt
 * of @getodk/xpath. Do NOT rely on these signatures outside of test stubs.
 *
 * Phase 2 plan:
 *   - Fork / adapt @getodk/xpath as the parser + evaluator core
 *   - Wire FormInstance / TreeReference as the context model
 *   - Replace the throw below with real dispatch
 *
 * Source oracle: JavaRosa XPathEvalTest.java, XPathParseTest.java
 */

// ---------------------------------------------------------------------------
// Provisional types — thin enough to let tests compile; subject to change.
// ---------------------------------------------------------------------------

/** Opaque handle for a parsed form instance. Phase 2 will use FormInstance. */
export type XPathInstance = Record<string, unknown>;

/** Opaque context reference. Phase 2 will use TreeReference. */
export type XPathContextRef = string | null;

/** Union of the primitive types an XPath expression can evaluate to. */
export type XPathResult = string | number | boolean | null;

// ---------------------------------------------------------------------------
// Provisional evaluation entry point
// ---------------------------------------------------------------------------

/**
 * Evaluate an XPath expression string against an instance and context.
 *
 * PROVISIONAL — throws until Phase 2 implements the real engine.
 */
export function evaluateXPath(
  _expr: string,
  _instance?: XPathInstance | null,
  _contextRef?: XPathContextRef
): XPathResult {
  throw new Error("not implemented: xpath evaluation (Phase 2)");
}
