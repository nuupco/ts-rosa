/**
 * Native `uuid()` XPath function for ts-rosa — Hermes-safe pure-JS v4.
 *
 * Design:
 *   - Default generator: pure Math.random-based RFC 4122 v4 UUID.
 *     NO globalThis.crypto, NO window.crypto, NO Node built-ins. Safe on Hermes (RN).
 *   - Injectable generator: module-level setter mirrors the
 *     `setActiveRelevanceCheck` seam in InstanceNodeXPathAdapter (existing
 *     ts-rosa injection idiom). Used in tests for reproducible output.
 *   - Registration: excluded from the vendor `xfString` spread in index.ts
 *     via an explicit exclusion list (see src/xpath/functions/index.ts, R1).
 *
 * uuid(n) length-parameter form:
 *   JavaRosa's uuid(n) calls genGUID(len) which produces base-36 random chars,
 *   NOT UUID concatenation/truncation as the vendor does. No XPathEvalTest
 *   fixture exists for this form. The length-arg path is retained for
 *   vendor-parity (concatenate+truncate) but is documented as out-of-scope per
 *   spec non-goals — its test is skipped in odk-functions.test.ts.
 *
 * Phase 6, Slice 6c (REQ-6C-1, REQ-6C-2, REQ-6C-3, REQ-6C-4, REQ-6C-5, REQ-X-3, REQ-X-6).
 */

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { StringFunction } from '../vendor/xpath/evaluator/functions/StringFunction.ts';

// ---------------------------------------------------------------------------
// UUID generator type and injectable seam
// ---------------------------------------------------------------------------

/** A function that returns a full RFC 4122 v4 UUID string. */
export type UuidGenerator = () => string;

/**
 * Pure-JS RFC 4122 v4 UUID generator.
 *
 * Uses Math.random exclusively — no crypto globals.
 * Forces version nibble to '4' and variant nibble to one of {8,9,a,b}.
 * Output: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (lowercase hex).
 */
function defaultUuidV4(): string {
  // 32 hex nibbles of random data
  const nibbles: string[] = [];
  for (let i = 0; i < 32; i++) {
    nibbles.push(Math.floor(Math.random() * 16).toString(16));
  }
  // Version: position 12 (0-indexed) = '4'
  nibbles[12] = '4';
  // Variant: position 16 = one of {8,9,a,b}
  nibbles[16] = (8 + Math.floor(Math.random() * 4)).toString(16);

  const h = nibbles.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let activeUuidGenerator: UuidGenerator = defaultUuidV4;

/**
 * Replace the active UUID generator. Pass `null` to reset to the default
 * pure-JS v4 implementation.
 *
 * Intended for test use only — inject a deterministic generator to produce
 * reproducible UUID values in tests (REQ-6C-4).
 */
export function setUuidGenerator(gen: UuidGenerator | null): void {
  activeUuidGenerator = gen ?? defaultUuidV4;
}

// ---------------------------------------------------------------------------
// uuid StringFunction
// ---------------------------------------------------------------------------

export const uuid = new StringFunction(
  'uuid',
  [{ arityType: 'optional', typeHint: 'number' }],
  <T extends XPathNode>(
    context: LocationPathEvaluation<T>,
    [lengthExpression]: readonly EvaluableArgument[]
  ): string => {
    let result = activeUuidGenerator();

    if (lengthExpression == null) {
      return result;
    }

    const outputLength = lengthExpression.evaluate(context).toNumber();

    if (Number.isNaN(outputLength)) {
      throw new Error(
        'Expected a valid number for the UUID length, but received NaN.'
      );
    }

    while (result.length < outputLength) {
      result += activeUuidGenerator();
    }

    return result.slice(0, outputLength);
  }
);
