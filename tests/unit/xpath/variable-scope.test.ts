/**
 * T5 — VariableScope module: module-level active-variable slot with
 * save/restore (design Decision 2 mechanism). This test is the key
 * re-entrancy proof (risk #2): nested synchronous evaluation must not
 * leak variable bindings between outer/inner scopes.
 */
import { describe, expect, it } from 'vitest';
import {
	setActiveVariables,
	getActiveVariable,
} from '../../../src/xpath/evaluator/VariableScope.ts';

describe('VariableScope — re-entrancy (save/restore)', () => {
	it('resolves bindings from the active map', () => {
		setActiveVariables(new Map([['x', 1]]), () => {
			expect(getActiveVariable('x')).toBe(1);
		});
	});

	it('returns undefined for names not present in the active map', () => {
		setActiveVariables(new Map([['x', 1]]), () => {
			expect(getActiveVariable('y')).toBeUndefined();
		});
	});

	it('returns undefined when no active scope has ever been set', () => {
		expect(getActiveVariable('anything')).toBeUndefined();
	});

	it('proves nested synchronous scopes do not leak into each other and restore correctly', () => {
		const mapA = new Map([['name', 'outer']]);
		const mapB = new Map([['name', 'inner']]);

		setActiveVariables(mapA, () => {
			expect(getActiveVariable('name')).toBe('outer');

			setActiveVariables(mapB, () => {
				expect(getActiveVariable('name')).toBe('inner');
			});

			// After the inner call restores, outer binding must be visible again.
			expect(getActiveVariable('name')).toBe('outer');
		});

		// After the outer call restores, no active scope remains.
		expect(getActiveVariable('name')).toBeUndefined();
	});

	it('restores the previous scope even when the callback throws', () => {
		const mapA = new Map([['name', 'outer']]);

		setActiveVariables(mapA, () => {
			expect(() => {
				setActiveVariables(new Map([['name', 'inner']]), () => {
					throw new Error('boom');
				});
			}).toThrow('boom');

			expect(getActiveVariable('name')).toBe('outer');
		});
	});
});
