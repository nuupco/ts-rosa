/**
 * Public value type for XPath `$name` variable bindings (design Decision 5).
 *
 * Primitives only for v1 — node-set-valued variables are explicitly out of
 * scope (would require wrapping foreign nodes into InstanceXPathNode /
 * XmldomNode, which is deferred to a future change alongside setvalue).
 */
export type XPathVariableValue = string | number | boolean;

/**
 * Bind-time guard: throws a clear error if `value` is not a supported
 * XPathVariableValue (i.e. it is a node-set / array / object). Enforced at
 * the seam boundary (XPathSeam.ts) before `setActiveVariables` is called, so
 * unsupported bindings fail loudly at the point the caller supplies them.
 */
export function assertXPathVariableValue(value: unknown, name: string): asserts value is XPathVariableValue {
	const type = typeof value;
	if (type === 'string' || type === 'number' || type === 'boolean') return;

	throw new TypeError(
		`Unsupported XPath variable value for $${name}: node-set/array/object bindings are not supported (primitives only). ` +
			'Node-set-valued variables are out of scope for this change.'
	);
}
