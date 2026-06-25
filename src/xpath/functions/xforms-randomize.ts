/**
 * Native `randomize()` XPath function for ts-rosa.
 *
 * Semantics (mirror vendor xforms/node-set.ts:368-402):
 *   - randomize(nodeset)       → shuffle with Math.random (unseeded).
 *   - randomize(nodeset, seed) → deterministic shuffle via JavaRosaPRNG.
 *
 * Imports `seededRandomize` directly from the vendor sort.ts (pure, no circular dep).
 * The `toBigIntHash` helper (SHA256-based string-seed derivation) is inlined here
 * to keep the shim self-contained and avoid importing from vendor xforms/node-set.ts
 * (which imports XFormsXPathEvaluator.ts — the source of the circular dependency
 * documented in src/xpath/functions/index.ts).
 *
 * Seed-handling is JavaRosa-compatible (NaN → 0, '' → 0, other strings → SHA256 hash).
 * See vendor JavaRosaPRNG and the comment at https://github.com/getodk/javarosa/issues/800.
 *
 * Phase 6, Slice 6b (REQ-6B-3, REQ-6B-4, REQ-6B-5, REQ-6B-6, REQ-X-3).
 */

import { SHA256 } from 'crypto-js';

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { NodeSetFunction } from '../vendor/xpath/evaluator/functions/NodeSetFunction.ts';
import { seededRandomize } from '../vendor/xpath/lib/collections/sort.ts';

/**
 * Derive a BigInt seed from a non-numeric string using SHA256.
 * Mirrors the vendor toBigIntHash in xforms/node-set.ts.
 * Takes the first 64 bits (two Int32 words) of the SHA256 digest and
 * interprets them as a big-endian Int64 — matching JavaRosa's implementation.
 */
function toBigIntHash(text: string): bigint {
  const buffer = new ArrayBuffer(8);
  const dataview = new DataView(buffer);
  SHA256(text)
    .words.slice(0, 2)
    .forEach((val: number, ix: number) =>
      dataview.setInt32(ix * Int32Array.BYTES_PER_ELEMENT, val)
    );
  return dataview.getBigInt64(0);
}

export const randomize = new NodeSetFunction(
  'randomize',
  [
    { arityType: 'required', typeHint: 'node' },
    { arityType: 'optional', typeHint: 'number' },
  ],
  <T extends XPathNode>(
    context: LocationPathEvaluation<T>,
    [expression, seedExpression]: readonly EvaluableArgument[]
  ): readonly T[] => {
    const results = expression!.evaluate(context);

    LocationPathEvaluation.assertInstance(context, results);

    const nodes = results.values().map(({ value }) => value);

    if (seedExpression === undefined) {
      return seededRandomize(nodes);
    }

    const seedValue = seedExpression.evaluate(context);
    const asNumber = seedValue.toNumber();

    let finalSeed: bigint | number;

    if (Number.isNaN(asNumber)) {
      const seedString = seedValue.toString();
      if (seedString === '') {
        finalSeed = 0; // JavaRosa special case: NaN from empty string → seed 0
      } else {
        finalSeed = toBigIntHash(seedString);
      }
    } else {
      finalSeed = asNumber;
    }

    return seededRandomize(nodes, finalSeed);
  }
);
