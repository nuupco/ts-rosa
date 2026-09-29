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
		// for NaN; we correct that here. JS's plain `String(Infinity)` /
		// `String(-Infinity)` already produce the correct 'Infinity' / '-Infinity',
		// so no explicit guard is needed for that case (verified, Part 4 T1).
		//
		// Ported from JavaRosa's XPathFuncExpr.toString(Object) (original Java
		// engine), which has two additional guard clauses ts-rosa lacked:
		// https://github.com/getodk/javarosa/blob/master/src/main/java/org/javarosa/xpath/expr/XPathFuncExpr.java#L804
		//   - snap-to-zero: |d| < 1e-12 => "0"
		//   - near-integer: |d - (int) d| < 1e-12 => String.valueOf((int) d)
		// Java's `(int) d` cast truncates toward zero, matching JS's Math.trunc().
		const truncated = Math.trunc(value);
		if (Number.isNaN(value)) {
			this.stringValue = 'NaN';
		} else if (Math.abs(value) < 1.0e-12) {
			this.stringValue = '0';
		} else if (Math.abs(value - truncated) < 1.0e-12) {
			this.stringValue = String(truncated);
		} else {
			this.stringValue = String(value);
		}
	}
}
