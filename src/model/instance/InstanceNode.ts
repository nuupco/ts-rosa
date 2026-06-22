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
