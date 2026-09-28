import type { InstanceNode } from '../../model/instance/InstanceNode.ts';

/** Reads an InstanceNode's value as a plain string, or null if it has none. */
export function nodeValueAsString(node: InstanceNode): string | null {
  const value = node.value;
  if (value == null) return null;
  return value.kind === 'string' || value.kind === 'uncast' ? value.value : value.displayText;
}
