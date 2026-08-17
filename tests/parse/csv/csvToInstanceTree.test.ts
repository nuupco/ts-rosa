import { describe, it, expect } from 'vitest';
import { csvToInstanceTree } from '../../../src/parse/csv/csvToInstanceTree.ts';

describe('csvToInstanceTree', () => {
  it('builds a root/item/{column} tree from header + data rows', () => {
    const csv = 'name,region\nMerida,Yucatan\nOaxaca,Oaxaca\n';
    const tree = csvToInstanceTree('cities', csv);

    expect(tree.name).toBe('cities');
    expect(tree.root.name).toBe('root');
    expect(tree.root.children).toHaveLength(2);

    const [item0, item1] = tree.root.children;
    expect(item0!.name).toBe('item');
    expect(item0!.children.map((c) => c.name)).toEqual(['name', 'region']);
    expect(item0!.children.map((c) => c.value?.value)).toEqual(['Merida', 'Yucatan']);

    expect(item1!.name).toBe('item');
    expect(item1!.children.map((c) => c.value?.value)).toEqual(['Oaxaca', 'Oaxaca']);
  });

  it('casts every leaf value to a string via the shared bindings pass', () => {
    const csv = 'count\n42\n';
    const tree = csvToInstanceTree('nums', csv);
    const leaf = tree.root.children[0]!.children[0]!;
    expect(leaf.value?.value).toBe('42');
    expect(leaf.value?.kind).toBe('string');
  });

  it('produces a header-only file as an empty item list', () => {
    const csv = 'name,region\n';
    const tree = csvToInstanceTree('cities', csv);
    expect(tree.root.name).toBe('root');
    expect(tree.root.children).toHaveLength(0);
  });

  it('throws on empty CSV content', () => {
    expect(() => csvToInstanceTree('cities', '')).toThrow(/empty/i);
  });

  it('throws on a data row with a different column count than the header (fail-loud)', () => {
    const csv = 'name,region\nMerida,Yucatan,extra\n';
    expect(() => csvToInstanceTree('cities', csv)).toThrow(/column count/i);
  });

  it('builds a large CSV (20k rows) in near-linear time with correct multiplicities', () => {
    // Regression test: appendChild(root, item) used to recompute each item's
    // multiplicity by scanning ALL of root's existing children on every
    // call — O(n) per row, O(n²) overall. That made a 100k-row secondary
    // instance CSV take ~84s to build (reported as an indefinite hang in a
    // consuming app). Fixed by assigning multiplicity directly, since rows
    // are appended in order and no other node under root is named 'item'.
    const N = 20_000;
    const rows = Array.from({ length: N }, (_, i) => `loc${i},Localidad ${i}`).join('\n');
    const csv = `name,label\n${rows}\n`;

    const t0 = performance.now();
    const tree = csvToInstanceTree('locations', csv);
    const elapsedMs = performance.now() - t0;

    expect(tree.root.children).toHaveLength(N);
    expect(tree.root.children[0]!.multiplicity).toBe(0);
    expect(tree.root.children[N - 1]!.multiplicity).toBe(N - 1);
    expect(tree.root.children[N - 1]!.children[0]!.value?.value).toBe(`loc${N - 1}`);
    // O(n²) would take tens of seconds at this size; O(n) finishes in well
    // under a second even on a loaded CI runner.
    expect(elapsedMs).toBeLessThan(5000);
  });

  it('matches the shape produced by inline buildInstanceTree for the equivalent XML', () => {
    // Equivalent inline instance: <root><item><name>Merida</name><region>Yucatan</region></item></root>
    const csv = 'name,region\nMerida,Yucatan\n';
    const tree = csvToInstanceTree('cities', csv);
    expect(tree.root.multiplicity).toBe(0);
    const item = tree.root.children[0]!;
    expect(item.multiplicity).toBe(0);
    expect(item.children[0]!.name).toBe('name');
    expect(item.children[0]!.multiplicity).toBe(0);
    expect(item.children[1]!.name).toBe('region');
    expect(item.children[1]!.multiplicity).toBe(0);
  });
});
