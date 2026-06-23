/**
 * indexed-repeat XPath function — extracted from the vendored xforms/node-set.ts
 * WITHOUT the XFormsXPathEvaluator circular dependency.
 *
 * The vendored xforms/node-set.ts imports XFormsXPathEvaluator which in turn
 * imports the full xf function set, creating a circular module graph that makes
 * the FunctionLibrary constructors receive undefined values. This module
 * selectively re-implements only the indexed-repeat function, skipping the
 * circular import.
 *
 * Source: src/xpath/vendor/xpath/functions/xforms/node-set.ts (indexedRepeat export)
 */

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { XPathDOMProvider } from '../vendor/xpath/adapter/xpathDOMProvider.ts';
import { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { NodeSetFunction } from '../vendor/xpath/evaluator/functions/NodeSetFunction.ts';

// ---------------------------------------------------------------------------
// Local helpers (mirrored from vendored xforms/node-set.ts)
// ---------------------------------------------------------------------------

type AssertArgument = (index: number, arg?: EvaluableArgument) => asserts arg is EvaluableArgument;

const assertArgument: AssertArgument = (index, arg) => {
  if (arg == null) {
    throw new Error(`Argument ${index + 1} expected`);
  }
};

const evaluateArgumentNodes = <T extends XPathNode>(
  context: LocationPathEvaluation<T>,
  arg: EvaluableArgument,
): readonly T[] => {
  const evaluation = arg.evaluate(context);
  LocationPathEvaluation.assertInstance(context, evaluation);
  return Array.from(evaluation.contextNodes);
};

interface EvaluatedIndexedRepeatArgumentPair<T extends XPathNode> {
  readonly repeats: readonly T[];
  readonly position: number;
}

type DepthSortResult = -1 | 0 | 1;

const compareContainmentDepth = <T extends XPathNode>(
  domProvider: XPathDOMProvider<T>,
  { repeats: a }: EvaluatedIndexedRepeatArgumentPair<T>,
  { repeats: b }: EvaluatedIndexedRepeatArgumentPair<T>,
): DepthSortResult => {
  for (const repeatA of a) {
    for (const repeatB of b) {
      if (domProvider.isDescendantNode(repeatA, repeatB)) {
        return -1;
      }
      if (domProvider.isDescendantNode(repeatB, repeatA)) {
        return 1;
      }
    }
  }
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  return 0;
};

// ---------------------------------------------------------------------------
// indexed-repeat function (ported from vendored node-set.ts)
// ---------------------------------------------------------------------------

export const indexedRepeat = new NodeSetFunction(
  'indexed-repeat',
  [
    { arityType: 'required', typeHint: 'node' },
    { arityType: 'required', typeHint: 'node' },
    { arityType: 'required', typeHint: 'number' },
    { arityType: 'optional', typeHint: 'node' },
    { arityType: 'optional', typeHint: 'number' },
    { arityType: 'optional', typeHint: 'node' },
    { arityType: 'optional', typeHint: 'number' },
    { arityType: 'variadic', typeHint: 'any' },
  ],
  <T extends XPathNode>(
    context: LocationPathEvaluation<T>,
    args: readonly EvaluableArgument[],
  ): readonly T[] => {
    const target = args[0]!;

    let pairs: Array<EvaluatedIndexedRepeatArgumentPair<T>> = [];

    for (let i = 1; i < args.length; i += 2) {
      const repeatsArg = args[i];
      const positionArg = args[i + 1];

      assertArgument(i, repeatsArg);
      assertArgument(i + 1, positionArg);

      const position = positionArg.evaluate(context).toNumber();

      if (Number.isNaN(position)) {
        return [];
      }

      const repeats = evaluateArgumentNodes(context, repeatsArg);

      if (repeats.length === 0) {
        return [];
      }

      pairs.push({ repeats, position });
    }

    const { domProvider } = context;

    pairs = pairs.sort((pairA, pairB) => compareContainmentDepth(domProvider, pairA, pairB));

    let repeatContextNode!: T;

    for (const [index, pair] of pairs.entries()) {
      const { position } = pair;
      let { repeats } = pair;

      if (index > 0) {
        repeats = pair.repeats.filter((repeat) => {
          return domProvider.isDescendantNode(repeatContextNode, repeat);
        });
      }

      const positionedRepeat = repeats[position - 1];

      if (positionedRepeat == null) {
        return [];
      }

      repeatContextNode = positionedRepeat;
    }

    const targetNodes = evaluateArgumentNodes(context, target);

    return targetNodes.filter((targetNode) => {
      return domProvider.isDescendantNode(repeatContextNode, targetNode);
    });
  },
);
