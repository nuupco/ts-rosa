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
  // ---- PRELOAD METADATA (Phase 7, Slice 7-INFRA-A) ----
  preload?: string | null;
  preloadParams?: string | null;
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
    const childClone = cloneNode(child);
    childClone.parent = clone;
    if (child.multiplicity === INDEX_TEMPLATE) {
      // Preserve nested repeat template nodes so that addRepeatInstance can
      // find a template when creating instances of inner repeats later.
      childClone.multiplicity = INDEX_TEMPLATE;
    } else {
      // Assign multiplicity = count of same-name non-template siblings already in clone
      const sameNameCount = clone.children.filter(
        (c) => c.name === childClone.name && c.multiplicity !== INDEX_TEMPLATE,
      ).length;
      childClone.multiplicity = sameNameCount;
    }
    clone.children.push(childClone);
  }
  return clone;
}
