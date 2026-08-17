/**
 * csvToInstanceTree — builds an InstanceTree from CSV text, structurally
 * identical to the tree buildInstanceTree produces for an equivalent inline
 * <root><item><col>..</col></item></root> secondary instance, so that
 * instance()/pulldata()/search()/itemset resolution require zero code
 * changes (design ADR-3).
 *
 * Fail-loud policy (design ADR-3 / spec R5): empty CSV content, and any data
 * row whose column count doesn't match the header, both throw rather than
 * silently producing a partial/empty instance.
 */

import type { InstanceTree } from '../../model/instance/InstanceTree.ts';
import { newNode, appendChild } from '../../model/instance/InstanceNode.ts';
import { parseCsv } from './parseCsv.ts';
import { cast } from '../../model/data/codecs.ts';

export function csvToInstanceTree(id: string, csvText: string): InstanceTree {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error(`csvToInstanceTree: CSV for instance '${id}' is empty`);
  }

  const [header, ...dataRows] = rows;
  const columns = header!;

  const root = newNode('root');

  dataRows.forEach((row, rowIndex) => {
    if (row.length !== columns.length) {
      throw new Error(
        `csvToInstanceTree: CSV for instance '${id}' has a column count mismatch at row ${
          rowIndex + 2
        } (header has ${columns.length} column(s), row has ${row.length})`,
      );
    }

    // Multiplicity is assigned directly (= rowIndex) instead of going through
    // appendChild(root, item): appendChild recomputes it by scanning ALL of
    // root's existing same-name children on every call, which is O(n) per
    // row and O(n²) overall for n rows — root has thousands to hundreds of
    // thousands of `item` children in a real CSV secondary instance, and
    // that quadratic blowup is what made large CSVs hang. Every prior row
    // is an `item` with no other same-name sibling, so rowIndex IS the
    // sibling count appendChild would have computed.
    const item = newNode('item', { multiplicity: rowIndex });
    item.parent = root;
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const columnName = columns[colIndex]!;
      const cell = row[colIndex]!;
      // Cast straight to the leaf's value: applyBindings' unbound-node branch
      // would do exactly this (cast('string', rawText)) via a round-trip
      // through node.attributes (RAW_TEXT_ATTR set, then read, then
      // deleted) — every CSV secondary instance is unbound, so that Map
      // round-trip is pure overhead here, and at hundreds of thousands of
      // cells the transient Map allocations were a real memory cost.
      const col = newNode(columnName, { value: cast('string', cell) ?? null });
      appendChild(item, col);
    }
    root.children.push(item);
  });

  return { root, name: id };
}
