/**
 * bindProcessor — extract DataBinding records from <bind> elements.
 *
 * XPATH FIREWALL: reads only `nodeset`/`ref`, `type`, and copies all XPath
 * expression attributes as raw strings. No parsing, no evaluation.
 */

import type { DataBinding } from '../model/def/DataBinding.ts';
import type { ControlType } from '../model/def/controlType.ts';
import { dataTypeFromXsdName, type DataType } from '../model/data/DataType.ts';
import { parseAbsoluteRef } from '../model/instance/TreeReference.ts';

/**
 * Derive DataType from a <bind type="..."> attribute value and an optional
 * control hint (the body element's localName, e.g. 'select1').
 *
 * - If typeAttr is present and non-null, use XSD name map.
 * - If typeAttr is null/empty, fall back to control hint if provided.
 * - Default: 'string'.
 */
export function dataTypeFromBindType(
  typeAttr: string | null,
  controlHint?: ControlType,
): DataType {
  if (typeAttr !== null && typeAttr !== '') {
    // Try direct match first (e.g. "int", "string", "boolean")
    // then try with xsd: prefix for XSD-namespaced values
    const direct = dataTypeFromXsdName(typeAttr);
    if (direct !== 'unsupported') return direct;
    // Try without xsd: prefix (bind type="int" is shorthand for xsd:int)
    const withPrefix = dataTypeFromXsdName(`xsd:${typeAttr}`);
    return withPrefix;
  }
  // No explicit type — use control hint if available
  if (controlHint === 'select1') return 'selectOne';
  if (controlHint === 'select') return 'selectMulti';
  return 'string';
}

/**
 * Process an array of <bind> Elements and return a Map keyed by the nodeset
 * attribute value. Each entry is a DataBinding with:
 *   - nodeset: the raw nodeset/ref attribute string
 *   - ref: parsed TreeReference (structural, no predicates)
 *   - dataType: resolved from 'type' attribute
 *   - relevant/required/readonly_/calculate/constraint/constraintMsg: RAW strings or null
 */
export function bindProcessor(binds: readonly Element[]): Map<string, DataBinding> {
  const result = new Map<string, DataBinding>();

  for (const el of binds) {
    // Support both 'nodeset' and 'ref' attribute names
    const nodeset =
      el.getAttribute('nodeset') ?? el.getAttribute('ref') ?? null;
    if (nodeset === null) continue;

    const typeAttr = el.getAttribute('type') ?? null;
    const dataType = dataTypeFromBindType(typeAttr);

    const binding: DataBinding = {
      nodeset,
      ref: parseAbsoluteRef(nodeset),
      dataType,
      relevant: el.getAttribute('relevant') ?? null,
      required: el.getAttribute('required') ?? null,
      readonly_: el.getAttribute('readonly') ?? null,
      calculate: el.getAttribute('calculate') ?? null,
      constraint: el.getAttribute('constraint') ?? null,
      constraintMsg:
        el.getAttribute('jr:constraintMsg') ??
        el.getAttribute('constraintMsg') ??
        null,
    };

    result.set(nodeset, binding);
  }

  return result;
}
