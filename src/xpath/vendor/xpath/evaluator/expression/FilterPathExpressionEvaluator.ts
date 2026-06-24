import type { XPathNode } from '../../adapter/interface/XPathNode.ts';
import type { EvaluationContext } from '../../context/EvaluationContext.ts';
import { LocationPathEvaluation } from '../../evaluations/LocationPathEvaluation.ts';
import type { FilterExprNode, FilterPathExprNode } from '../../static/grammar/SyntaxNode.ts';
import type { ExpressionEvaluator } from './ExpressionEvaluator.ts';
import { LocationPathEvaluator } from './LocationPathEvaluator.ts';
import type { LocationPathExpressionEvaluator } from './LocationPathExpressionEvaluator.ts';
import { createExpression } from './factory.ts';

export class FilterPathExpressionEvaluator
	extends LocationPathEvaluator
	implements ExpressionEvaluator
{
	readonly filterExpression: LocationPathExpressionEvaluator;
	readonly hasSteps: boolean;

	constructor(override readonly syntaxNode: FilterPathExprNode) {
		const [filterExprNode, ...rest] = syntaxNode.children;

		super(syntaxNode, {
			isAbsolute: false,
			isFilterExprContext: true,
			isRoot: false,
			isSelf: false,
		});

		this.hasSteps = rest.length > 0;

		// When the first child is itself a filter_path_expr (nested case, e.g.
		// `instance('id')/a/b[p]` as the base of a further path), use the whole
		// inner expression as the filter expression. Otherwise, unwrap the single
		// filter_expr child to obtain the actual evaluable expression node.
		//
		// NOTE: the TypeScript type declares the first child as FilterExprNode, but
		// the runtime tree-sitter grammar can produce FilterPathExprNode as the first
		// child when the base expression itself has path steps (e.g. multi-segment
		// instance paths). The `as unknown` cast bridges this gap safely.
		const firstChildNode = filterExprNode as unknown as FilterExprNode | FilterPathExprNode;
		if (firstChildNode.type === 'filter_path_expr') {
			// TODO: possibly an unsafe cast!
			this.filterExpression = createExpression(firstChildNode) as LocationPathExpressionEvaluator;
		} else {
			const [exprNode] = (firstChildNode as FilterExprNode).children;
			// TODO: possibly an unsafe cast!
			this.filterExpression = createExpression(exprNode) as LocationPathExpressionEvaluator;
		}
	}

	override evaluateNodes<T extends XPathNode>(context: EvaluationContext<T>): ReadonlySet<T> {
		// TODO: this check may not be necessary
		if (this.hasSteps) {
			const filterContextResults = this.filterExpression.evaluate(context);

			LocationPathEvaluation.assertInstance(context, filterContextResults);

			return super.evaluateNodes(filterContextResults);
		}

		return this.filterExpression.evaluateNodes(context);
	}
}
