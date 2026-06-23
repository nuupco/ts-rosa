import type { DataType } from '../data/DataType';
import type { TreeReference } from '../instance/TreeReference';

/**
 * DataBinding — the parsed form of a <bind> element.
 *
 * XPATH FIREWALL: relevant/required/readonly_/calculate/constraint/constraintMsg are stored
 * as RAW STRINGS only. They are NEVER parsed, compiled, or evaluated in Phase 1.
 * Phase 3 will consume these raw strings to produce Triggerables.
 */
export type DataBinding = {
  readonly nodeset: string;           // raw nodeset attribute (map key)
  readonly ref: TreeReference;        // parsed from nodeset (structural only, no predicates)
  readonly dataType: DataType;        // from `type` attr via XSD map; default 'string'
  // ---- RAW XPATH STRINGS — NEVER COMPILED IN PHASE 1 ----
  readonly relevant: string | null;
  readonly required: string | null;
  readonly readonly_: string | null;  // 'readonly' is a reserved word; suffix underscore
  readonly calculate: string | null;
  readonly constraint: string | null;
  readonly constraintMsg: string | null;
};
