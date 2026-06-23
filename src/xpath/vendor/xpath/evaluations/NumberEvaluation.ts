import type { XPathNode } from '../adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from './LocationPathEvaluation.ts';
import { ValueEvaluation } from './ValueEvaluation.ts';

export class NumberEvaluation<T extends XPathNode> extends ValueEvaluation<T, 'NUMBER'> {
	readonly type = 'NUMBER';
	readonly nodes = null;

	protected readonly booleanValue: boolean;
	protected readonly numberValue: number;
	protected readonly stringValue: string;

	constructor(
		readonly context: LocationPathEvaluation<T>,
		readonly value: number
	) {
		super();

		this.booleanValue = value !== 0 && !Number.isNaN(value);
		this.numberValue = value;
		// XPath 1.0 §4.2 / JavaRosa: string(NaN) = 'NaN', string(Infinity) = 'Infinity',
		// string(-Infinity) = '-Infinity'. The upstream vendor erroneously returned ''
		// for NaN; we correct that here.
		this.stringValue = Number.isNaN(value) ? 'NaN' : String(value);
	}
}
