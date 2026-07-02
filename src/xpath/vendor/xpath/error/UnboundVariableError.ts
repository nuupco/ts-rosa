import { JRCompatibleError } from './JRCompatibleError.ts';

/**
 * Thrown when an XPath `$name` variable reference has no bound value in the
 * active variable scope (design Decision 4). Fail-loud, at evaluation time —
 * mirrors JavaRosa's XPathUnhandledException behavior for unbound variables.
 */
export class UnboundVariableError extends JRCompatibleError {
	constructor(name: string) {
		super(`Undefined XPath variable: $${name}`);
		this.name = 'UnboundVariableError';
	}
}
