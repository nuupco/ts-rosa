import type { XPathNode } from '../../adapter/interface/XPathNode.ts';
import type { EvaluationContext } from '../../context/EvaluationContext.ts';
import { BooleanEvaluation } from '../../evaluations/BooleanEvaluation.ts';
import type { Evaluation } from '../../evaluations/Evaluation.ts';
import { NumberEvaluation } from '../../evaluations/NumberEvaluation.ts';
import { StringEvaluation } from '../../evaluations/StringEvaluation.ts';
import { UnboundVariableError } from '../../error/UnboundVariableError.ts';
import type { VariableReferenceNode } from '../../static/grammar/SyntaxNode.ts';
import { getActiveVariable } from '../../../../evaluator/VariableScope.ts';
import type { ExpressionEvaluator, ExpressionNode } from './ExpressionEvaluator.ts';

/**
 * Resolves an XPath `$name` VariableReference against the independent
 * active-variable scope (design Decision 2) — NOT the vendor's broken,
 * unwired EvaluationContext variable machinery.
 *
 * Bind-time value type determines the wrapped Evaluation subtype
 * (design Decision 5): no coercion happens here — normal XPath 1.0
 * coercion applies automatically once the value is wrapped, because each
 * Evaluation subtype exposes booleanValue/numberValue/stringValue.
 */
export class VariableReferenceExpressionEvaluator implements ExpressionEvaluator {
	constructor(readonly syntaxNode: VariableReferenceNode) {}

	evaluate<T extends XPathNode>(context: EvaluationContext<T>): Evaluation<T> {
		const name = this.syntaxNode.text.slice(1);
		const value = getActiveVariable(name);

		if (value === undefined) {
			throw new UnboundVariableError(name);
		}

		const currentContext = context.currentContext();

		switch (typeof value) {
			case 'number':
				return new NumberEvaluation(currentContext, value);
			case 'boolean':
				return new BooleanEvaluation(currentContext, value);
			default:
				return new StringEvaluation(currentContext, value);
		}
	}
}
