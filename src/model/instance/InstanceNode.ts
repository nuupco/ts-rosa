import type { AnswerValue } from '../data/AnswerValue';
import type { DataType } from '../data/DataType';
import { DEFAULT_MULTIPLICITY, INDEX_TEMPLATE, type Multiplicity } from './multiplicity';

export type InstanceNode = {
  readonly name: string;
  multiplicity: Multiplicity;
  value: AnswerValue | null;
  readonly children: InstanceNode[];
  // Lazily allocated: most nodes (e.g. every CSV-sourced secondary instance
  // leaf) never carry a real XML attribute, and an eagerly-allocated empty
  // Map costs real memory at scale (hundreds of thousands of nodes for a
  // large jr://file-csv/* instance). Use getAttribute/setAttribute/
  // deleteAttribute/attributeNames below instead of touching this directly.
  attributes: Map<string, string> | null;
  dataType: DataType;
  parent: InstanceNode | null;
  // ---- PRELOAD METADATA (Phase 7, Slice 7-INFRA-A) ----
  preload?: string | null;
  preloadParams?: string | null;
};

export function getAttribute(node: InstanceNode, name: string): string | undefined {
  return node.attributes?.get(name);
}

export function setAttribute(node: InstanceNode, name: string, value: string): void {
  (node.attributes ??= new Map()).set(name, value);
}

export function deleteAttribute(node: InstanceNode, name: string): void {
  node.attributes?.delete(name);
}

export function attributeNames(node: InstanceNode): string[] {
  return node.attributes === null ? [] : Array.from(node.attributes.keys());
}

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
    attributes: null,
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
 * Same-name children that are NOT repeat templates — the "candidates" set
 * used throughout TreeReference resolution (resolveReference/resolveAll/
 * resolveAllWithin/resolveAllContextualized). Single pass over
 * `node.children`, rather than `childrenNamed(...).filter(...)`'s two
 * chained scans — halves the per-level scan cost of every reference
 * resolution.
 */
export function realChildrenNamed(node: InstanceNode, name: string): InstanceNode[] {
  const result: InstanceNode[] = [];
  for (const child of node.children) {
    if (child.name === name && child.multiplicity !== INDEX_TEMPLATE) {
      result.push(child);
    }
  }
  return result;
}

/**
 * The Nth (0-indexed) same-name non-template child, or null if there aren't
 * that many. Single pass with early exit as soon as the target position is
 * reached — avoids materializing the full candidates array (via
 * `realChildrenNamed`) when only one position is actually needed, which is
 * the common case (a concrete or default-multiplicity reference level).
 */
export function nthRealChildNamed(node: InstanceNode, name: string, index: number): InstanceNode | null {
  if (index < 0) return null;

  let count = 0;
  for (const child of node.children) {
    if (child.name === name && child.multiplicity !== INDEX_TEMPLATE) {
      if (count === index) return child;
      count++;
    }
  }

  return null;
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
    attributes: source.attributes === null ? null : new Map(source.attributes),
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
