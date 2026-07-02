/**
 * T4 — UnboundVariableError class (design Decision 4).
 */
import { describe, expect, it } from 'vitest';
import { UnboundVariableError } from '../../../src/xpath/vendor/xpath/error/UnboundVariableError.ts';
import { JRCompatibleError } from '../../../src/xpath/vendor/xpath/error/JRCompatibleError.ts';

describe('UnboundVariableError', () => {
	it('extends JRCompatibleError', () => {
		const error = new UnboundVariableError('foo');

		expect(error).toBeInstanceOf(JRCompatibleError);
		expect(error).toBeInstanceOf(Error);
	});

	it('has name === "UnboundVariableError"', () => {
		const error = new UnboundVariableError('foo');

		expect(error.name).toBe('UnboundVariableError');
	});

	it('has message "Undefined XPath variable: $foo"', () => {
		const error = new UnboundVariableError('foo');

		expect(error.message).toBe('Undefined XPath variable: $foo');
	});
});
