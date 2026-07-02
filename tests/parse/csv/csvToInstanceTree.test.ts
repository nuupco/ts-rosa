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
