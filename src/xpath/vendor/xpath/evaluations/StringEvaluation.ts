import type { XPathNode } from '../adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from './LocationPathEvaluation.ts';
import { ValueEvaluation } from './ValueEvaluation.ts';

/**
 * JavaRosa-compatible string-to-number conversion.
 *
 * XPath 1.0 §4.4 + JavaRosa override: a string is a valid number only if it
 * consists of optional leading/trailing whitespace around an XPath numeric
 * literal (decimal digits with optional `.`). Scientific notation (e.g.
 * '1.1e6') and the literal string 'Infinity' are NOT valid and must return
 * NaN — matching JavaRosa's XPathFuncExpr.toNumeric() behavior.
 *
 * PATCH: upstream used plain Number(value) which accepts 'Infinity' and
 * scientific notation. JavaRosa rejects both.
 * See: src/xpath/vendor/PATCHES.md — StringEvaluation javarosa-number-parse
 */
const JAVAROSA_NUMBER_RE = /^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/;

const javarosaParseNumber = (value: string): number => {
	if (!JAVAROSA_NUMBER_RE.test(value)) {
		return NaN;
	}
	return Number(value);
};

export class StringEvaluation<T extends XPathNode> extends ValueEvaluation<T, 'STRING'> {
	readonly type = 'STRING';
	readonly nodes = null;

	protected readonly booleanValue: boolean;
	protected readonly numberValue: number;
	protected readonly stringValue: string;

	constructor(
		readonly context: LocationPathEvaluation<T>,
		readonly value: string,
		readonly isEmpty: boolean = value === ''
	) {
		super();

		this.booleanValue = !isEmpty;
		this.stringValue = value;

		if (isEmpty) {
			this.numberValue = NaN;
		} else {
			this.numberValue = javarosaParseNumber(value);

			const numberFunction = context.functions.getDefaultImplementation('number');

			if (numberFunction != null) {
				this.numberValue = numberFunction
					.call(context, [
						{
							evaluate: () => this,
						},
					])
					.toNumber();
			}
		}
	}
}
