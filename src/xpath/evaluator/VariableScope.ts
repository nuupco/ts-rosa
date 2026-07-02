/**
 * VariableScope — module-level active-variable slot for XPath `$name`
 * resolution (design Decision 2).
 *
 * This is an INDEPENDENT resolution layer that does NOT depend on the
 * vendored evaluator's (broken, unwired) EvaluationContext variable
 * handling. It mirrors the module-level active-slot pattern already proven
 * by `activeRelevanceCheck` (InstanceNodeXPathAdapter.ts), but wraps the
 * set/restore in a callback so nested synchronous evaluation is
 * re-entrancy safe by construction (save previous, set, run, restore in
 * `finally` — even if the callback throws).
 *
 * Serves BOTH xmldomEvaluator and instanceEvaluator with ONE mechanism,
 * since it is node-type-agnostic.
 */

import type { XPathVariableValue } from './XPathVariableValue.ts';

export type ActiveVariableMap = ReadonlyMap<string, XPathVariableValue>;

let activeVariables: ActiveVariableMap | null = null;

/**
 * Run `fn` with `map` as the active variable scope, restoring the previous
 * scope (even on throw) before returning.
 */
export function setActiveVariables<T>(map: ActiveVariableMap, fn: () => T): T {
	const previous = activeVariables;
	activeVariables = map;
	try {
		return fn();
	} finally {
		activeVariables = previous;
	}
}

/**
 * Look up `name` in the active variable scope. Returns `undefined` when no
 * scope is active, or when the name is not bound in the active scope.
 */
export function getActiveVariable(name: string): XPathVariableValue | undefined {
	return activeVariables?.get(name);
}
