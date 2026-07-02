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
import { applyBindings, RAW_TEXT_ATTR } from '../XFormParser.ts';

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

    const item = newNode('item');
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const columnName = columns[colIndex]!;
      const cell = row[colIndex]!;
      const col = newNode(columnName);
      col.attributes.set(RAW_TEXT_ATTR, cell);
      appendChild(item, col);
    }
    appendChild(root, item);
  });

  const tree: InstanceTree = { root, name: id };
  applyBindings(tree, new Map());
  return tree;
}
