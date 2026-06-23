import type { AnswerValue } from '../data/AnswerValue';
import type { DataType } from '../data/DataType';
import { DEFAULT_MULTIPLICITY, INDEX_TEMPLATE, type Multiplicity } from './multiplicity';

export type InstanceNode = {
  readonly name: string;
  multiplicity: Multiplicity;
  value: AnswerValue | null;
  readonly children: InstanceNode[];
  readonly attributes: Map<string, string>;
  dataType: DataType;
  parent: InstanceNode | null;
};

export interface NewNodeOptions {
  multiplicity?: Multiplicity;
  value?: AnswerValue | null;
  dataType?: DataType;
}

export function newNode(name: string, opts?: NewNodeOptions): InstanceNode {
  return {
    name,
    multiplicity: opts?.multiplicity ?? DEFAULT_MULTIPLICITY,
    value: opts?.value ?? null,
    children: [],
    attributes: new Map(),
    dataType: opts?.dataType ?? 'string',
    parent: null,
  };
}

export function appendChild(parent: InstanceNode, child: InstanceNode): void {
  child.parent = parent;
  // Assign multiplicity = count of same-name siblings already present
  const sameNameCount = parent.children.filter((c) => c.name === child.name).length;
  // Do not override a manually set template multiplicity
  if (child.multiplicity !== INDEX_TEMPLATE) {
    child.multiplicity = sameNameCount;
  }
  parent.children.push(child);
}

export function childrenNamed(node: InstanceNode, name: string): InstanceNode[] {
  return node.children.filter((c) => c.name === name);
}

/**
 * Deep-clone an InstanceNode subtree.
 * The clone has no parent set (caller must appendChild).
 * Multiplicity is reset to DEFAULT_MULTIPLICITY (appendChild will update it).
 */
export function cloneNode(source: InstanceNode): InstanceNode {
  const clone: InstanceNode = {
    name: source.name,
    multiplicity: DEFAULT_MULTIPLICITY,
    value: source.value,
    children: [],
    attributes: new Map(source.attributes),
    dataType: source.dataType,
    parent: null,
  };
  for (const child of source.children) {
    if (child.multiplicity === INDEX_TEMPLATE) continue; // skip nested templates
    const childClone = cloneNode(child);
    childClone.parent = clone;
    // Assign multiplicity = count of same-name siblings already in clone
    const sameNameCount = clone.children.filter((c) => c.name === childClone.name).length;
    childClone.multiplicity = sameNameCount;
    clone.children.push(childClone);
  }
  return clone;
}
