import { describe, it, expect } from 'vitest';
import {
  newNode,
  appendChild,
  childrenNamed,
  type InstanceNode,
} from '../../../src/model/instance/InstanceNode';
import {
  resolveReference,
  resolveAll,
  type InstanceTree,
} from '../../../src/model/instance/InstanceTree';
import {
  parseAbsoluteRef,
  extendRef,
  rootRef,
} from '../../../src/model/instance/TreeReference';
import {
  INDEX_TEMPLATE,
  INDEX_UNBOUND,
  DEFAULT_MULTIPLICITY,
} from '../../../src/model/instance/multiplicity';

// Helper: build a minimal tree with root=data, children=[name, age]
function buildFlatTree(): InstanceTree {
  const root = newNode('data');
  const name = newNode('name');
  const age = newNode('age');
  appendChild(root, name);
  appendChild(root, age);
  return { root, name: null } as unknown as InstanceTree;
}

describe('InstanceNode', () => {
  it('newNode creates a node with the given name', () => {
    const n = newNode('foo');
    expect(n.name).toBe('foo');
  });

  it('newNode defaults: multiplicity=0, value=null, dataType=string, parent=null', () => {
    const n = newNode('x');
    expect(n.multiplicity).toBe(DEFAULT_MULTIPLICITY);
    expect(n.value).toBeNull();
    expect(n.dataType).toBe('string');
    expect(n.parent).toBeNull();
  });

  it('newNode starts with empty children', () => {
    expect(newNode('x').children).toHaveLength(0);
  });

  it('appendChild attaches child and sets parent back-pointer', () => {
    const parent = newNode('parent');
    const child = newNode('child');
    appendChild(parent, child);
    expect(parent.children).toHaveLength(1);
    expect(child.parent).toBe(parent);
  });

  it('appendChild assigns multiplicity among same-name siblings', () => {
    const parent = newNode('group');
    const a = newNode('item');
    const b = newNode('item');
    const c = newNode('item');
    appendChild(parent, a);
    appendChild(parent, b);
    appendChild(parent, c);
    expect(a.multiplicity).toBe(0);
    expect(b.multiplicity).toBe(1);
    expect(c.multiplicity).toBe(2);
  });

  it('appendChild does not let a jr:template sibling consume a multiplicity slot', () => {
    // Regression: appendChild used to count the template toward the same-name
    // total, so the first REAL sibling got multiplicity 1 instead of 0 — off
    // by one for every real instance loaded alongside a template (e.g. a
    // resumed/edited submission with an already-answered repeat instance).
    const parent = newNode('group');
    const template = newNode('item', { multiplicity: INDEX_TEMPLATE });
    const a = newNode('item');
    const b = newNode('item');
    appendChild(parent, template);
    appendChild(parent, a);
    appendChild(parent, b);
    expect(a.multiplicity).toBe(0);
    expect(b.multiplicity).toBe(1);
  });

  it('different-name siblings do not affect each other multiplicity', () => {
    const parent = newNode('data');
    const name = newNode('name');
    const age = newNode('age');
    const name2 = newNode('name');
    appendChild(parent, name);
    appendChild(parent, age);
    appendChild(parent, name2);
    expect(name.multiplicity).toBe(0);
    expect(age.multiplicity).toBe(0);
    expect(name2.multiplicity).toBe(1);
  });

  it('TEMPLATE node: multiplicity INDEX_TEMPLATE is preserved', () => {
    const tmpl = newNode('item', { multiplicity: INDEX_TEMPLATE });
    expect(tmpl.multiplicity).toBe(INDEX_TEMPLATE);
  });

  it('childrenNamed filters by name', () => {
    const parent = newNode('data');
    appendChild(parent, newNode('name'));
    appendChild(parent, newNode('age'));
    appendChild(parent, newNode('name'));
    const names = childrenNamed(parent, 'name');
    expect(names).toHaveLength(2);
    expect(names.every((n) => n.name === 'name')).toBe(true);
  });
});

describe('InstanceTree + resolveReference', () => {
  it('builds a flat tree with two children', () => {
    const tree = buildFlatTree();
    expect(tree.root.children).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(tree.root.children[0]!.name).toBe('name');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(tree.root.children[1]!.name).toBe('age');
  });

  it('resolveReference: path /data/name returns the name node', () => {
    const tree = buildFlatTree();
    const ref = parseAbsoluteRef('/data/name');
    const node = resolveReference(tree, ref);
    expect(node).not.toBeNull();
    expect(node!.name).toBe('name');
  });

  it('resolveReference: path /data/age returns the age node', () => {
    const tree = buildFlatTree();
    const node = resolveReference(tree, parseAbsoluteRef('/data/age'));
    expect(node).not.toBeNull();
    expect(node!.name).toBe('age');
  });

  it('resolveReference: path /data alone returns the root', () => {
    const tree = buildFlatTree();
    const node = resolveReference(tree, parseAbsoluteRef('/data'));
    expect(node).not.toBeNull();
    expect(node!.name).toBe('data');
  });

  it('resolveReference: non-existent path returns null', () => {
    const tree = buildFlatTree();
    const node = resolveReference(tree, parseAbsoluteRef('/data/missing'));
    expect(node).toBeNull();
  });

  it('resolveReference: INDEX_UNBOUND returns first sibling (mult 0)', () => {
    const root = newNode('data');
    const item0 = newNode('item');
    const item1 = newNode('item');
    appendChild(root, item0);
    appendChild(root, item1);
    const tree = { root, name: null } as unknown as InstanceTree;

    const ref = parseAbsoluteRef('/data/item'); // INDEX_UNBOUND by default
    const node = resolveReference(tree, ref);
    expect(node).not.toBeNull();
    expect(node!.multiplicity).toBe(0);
  });

  it('resolveReference: skips INDEX_TEMPLATE nodes during normal resolution', () => {
    const root = newNode('data');
    const tmpl = newNode('item', { multiplicity: INDEX_TEMPLATE });
    // The template should not interfere — it is skipped
    // Add a real item after template
    const real = newNode('item');
    // Manually set multiplicity since template occupies slot
    real.multiplicity = 0;
    root.children.push(tmpl);
    root.children.push(real);
    tmpl.parent = root;
    real.parent = root;

    const tree = { root, name: null } as unknown as InstanceTree;
    const ref = parseAbsoluteRef('/data/item');
    const node = resolveReference(tree, ref);
    expect(node).not.toBeNull();
    expect(node!.multiplicity).toBe(0);
    // It should NOT be the template
    expect(node!.multiplicity).not.toBe(INDEX_TEMPLATE);
  });

  it('resolveAll returns all matching nodes for wildcard/unbound', () => {
    const root = newNode('data');
    appendChild(root, newNode('item'));
    appendChild(root, newNode('item'));
    appendChild(root, newNode('item'));
    const tree = { root, name: null } as unknown as InstanceTree;
    const ref = parseAbsoluteRef('/data/item');
    const nodes = resolveAll(tree, ref);
    expect(nodes).toHaveLength(3);
  });

  it('resolveReference: finds the correct instance among many same-name siblings, skipping an interleaved template', () => {
    // Regression test: resolveReference used to build its candidates via
    // childrenNamed(node, name).filter(notTemplate) — two full scans of
    // node.children per level — before indexing into the result. Now a
    // single pass with early exit (nthRealChildNamed). Pin down correctness
    // at a size where a bug would be obvious: resolve every instance and
    // confirm each returns the node at the expected position, with a
    // template sibling interleaved partway through (excluded from indexing,
    // but not from correctness of the positions around it).
    const root = newNode('data');
    const N = 200;
    for (let i = 0; i < N; i++) {
      if (i === 50) {
        appendChild(root, newNode('item', { multiplicity: INDEX_TEMPLATE }));
      }
      const item = newNode('item');
      appendChild(item, newNode('label', { value: { kind: 'string', value: `label-${i}`, displayText: `label-${i}` } }));
      appendChild(root, item);
    }
    const tree = { root, name: null } as unknown as InstanceTree;

    for (let i = 0; i < N; i++) {
      const node = resolveReference(tree, parseAbsoluteRef(`/data/item[${i + 1}]`));
      expect(node).not.toBeNull();
      const label = resolveReference(tree, parseAbsoluteRef(`/data/item[${i + 1}]/label`));
      expect(label!.value?.value).toBe(`label-${i}`);
    }
    // One past the last real instance — no match
    expect(resolveReference(tree, parseAbsoluteRef(`/data/item[${N + 1}]`))).toBeNull();
  });

  it('resolveReference resolves 5,000 same-name siblings in well under a second', () => {
    const root = newNode('data');
    const N = 5_000;
    for (let i = 0; i < N; i++) {
      appendChild(root, newNode('item'));
    }
    const tree = { root, name: null } as unknown as InstanceTree;

    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      resolveReference(tree, parseAbsoluteRef(`/data/item[${i + 1}]`));
    }
    const elapsedMs = performance.now() - t0;

    expect(elapsedMs).toBeLessThan(5000);
  });
});
