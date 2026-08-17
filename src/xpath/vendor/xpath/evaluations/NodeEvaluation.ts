import { trimXMLXPathWhitespace } from '../../common/lib/string/whitespace.ts';
import type { XPathNode } from '../adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from './LocationPathEvaluation.ts';
import { StringEvaluation } from './StringEvaluation.ts';
import { ValueEvaluation } from './ValueEvaluation.ts';

export class NodeEvaluation<T extends XPathNode> extends ValueEvaluation<T, 'NODE'> {
	readonly type = 'NODE';

	// PERF (ts-rosa-original): each of nodes/stringValue/numberValue/isEmpty is
	// computed lazily and cached independently, rather than eagerly computing
	// all four together on first access (as an upstream single computeValues()
	// pass did). Most XPath comparisons only ever read one of these — e.g.
	// ValueEvaluation.eq() for a NODE-vs-STRING comparison (the common
	// itemset choice_filter shape: item[col = 'literal']) only calls
	// toString(), never toNumber() — so eagerly computing numberValue
	// (a function-registry lookup + StringEvaluation construction) for
	// every context node visited during a predicate scan was pure waste.
	// At hundreds of thousands of nodes (e.g. a large CSV secondary
	// instance filtered by a single-select), that waste dominated the
	// evaluation cost of the whole expression.
	protected _nodes: ReadonlySet<T> | undefined;
	protected _stringValue: string | undefined;
	protected _isEmpty: boolean | undefined;
	protected _numberValue: number | undefined;

	get nodes(): ReadonlySet<T> {
		let nodes = this._nodes;

		if (nodes === undefined) {
			nodes = new Set([this.value]);
			this._nodes = nodes;
		}

		return nodes;
	}

	protected getStringValue(): string {
		let stringValue = this._stringValue;

		if (stringValue === undefined) {
			stringValue = this.context.domProvider.getNodeValue(this.value);
			this._stringValue = stringValue;
		}

		return stringValue;
	}

	protected getIsEmpty(): boolean {
		let isEmpty = this._isEmpty;

		if (isEmpty === undefined) {
			isEmpty = trimXMLXPathWhitespace(this.getStringValue()) === '';
			this._isEmpty = isEmpty;
		}

		return isEmpty;
	}

	protected get booleanValue(): boolean {
		return !this.getIsEmpty();
	}

	protected get numberValue(): number {
		let numberValue = this._numberValue;

		if (numberValue === undefined) {
			numberValue = this.computeNumberValue();
			this._numberValue = numberValue;
		}

		return numberValue;
	}

	protected get stringValue(): string {
		return this.getStringValue();
	}

	get isEmpty(): boolean {
		return this.getIsEmpty();
	}

	constructor(
		readonly context: LocationPathEvaluation<T>,
		readonly value: T
	) {
		super();
	}

	private computeNumberValue(): number {
		const { context } = this;

		// Note: without this `isEmpty` check, `Number('')` would produce 0.
		// Which is wrong! Thanks, Netscape!
		if (this.getIsEmpty()) {
			return NaN;
		}

		const numberFunction = context.functions.getDefaultImplementation('number');

		if (numberFunction == null) {
			return Number(this.getStringValue());
		}

		const stringEvaluation = new StringEvaluation(context, this.getStringValue());

		return numberFunction
			.call(context, [
				{
					evaluate: () => stringEvaluation,
				},
			])
			.toNumber();
	}
}
