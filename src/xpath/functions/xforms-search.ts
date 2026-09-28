/**
 * Native `search()` XPath function for ts-rosa.
 *
 * Not a JavaRosa/ODK XForms-spec function — confirmed absent from both the
 * XForms spec (getodk/xforms-spec) and JavaRosa's XPathFuncExpr (no `search`
 * registration anywhere in reference/javarosa). It is a pyxform/Kobo/Enketo
 * choice_filter extension (xlsform.org, "Dynamic selects from pre-loaded
 * data"): pyxform compiles a `search_choice_filter` column verbatim into the
 * itemset nodeset's predicate —
 *   instance('sectores')/root/item[search('sectores','matches','id_huerta',/data/id_huerta)]
 * — so, per XPath 1.0 predicate semantics, search() is evaluated once PER
 * CANDIDATE item with that item as `context.contextNode`: it must decide
 * whether THIS item matches, not build an independent global result set
 * (a node-set predicate only coerces to true/false via non-emptiness, which
 * would make every item match as soon as any single row did).
 *
 * Documented signature (xlsform.org):
 *   search(csvName)
 *   search(csvName, searchType, columnsToSearch, searchText)
 *   search(csvName, searchType, columnsToSearch, searchText, columnToFilter, filterText)
 *
 *   - csvName: secondary instance id (typically a jr://file-csv/* instance).
 *   - columnsToSearch: one column name, or a comma-separated list — a match
 *     in ANY listed column counts.
 *   - searchType: 'matches' (exact equality), 'contains' (substring),
 *     'startswith' (prefix), or 'endswith' (suffix).
 *   - optional columnToFilter/filterText: an additional exact-equality
 *     condition the item must also satisfy.
 *
 * The 1-arg form (`search(csvName)`, "every row") has no per-item filter
 * criteria, so every item matches — it is the search()-as-whole-itemset
 * case, not the choice_filter predicate case this shim primarily targets,
 * but the semantics compose correctly either way.
 */

import type { XPathNode } from '../vendor/xpath/adapter/interface/XPathNode.ts';
import type { LocationPathEvaluation } from '../vendor/xpath/evaluations/LocationPathEvaluation.ts';
import type { EvaluableArgument } from '../vendor/xpath/evaluator/functions/FunctionImplementation.ts';
import { BooleanFunction } from '../vendor/xpath/evaluator/functions/BooleanFunction.ts';
import type { InstanceDocumentNode, InstanceXPathNode } from '../adapter/instance/InstanceXPathNode.ts';
import { nodeValueAsString } from './instanceNodeValue.ts';

type SearchType = 'matches' | 'contains' | 'startswith' | 'endswith';

function matchesSearchType(type: SearchType, value: string, searchText: string): boolean {
  switch (type) {
    case 'matches':
      return value === searchText;
    case 'contains':
      return value.includes(searchText);
    case 'startswith':
      return value.startsWith(searchText);
    case 'endswith':
      return value.endsWith(searchText);
  }
}

function isSearchType(value: string): value is SearchType {
  return value === 'matches' || value === 'contains' || value === 'startswith' || value === 'endswith';
}

export const search = new BooleanFunction(
  'search',
  [
    { arityType: 'required', typeHint: 'string' },
    { arityType: 'optional', typeHint: 'string' },
    { arityType: 'optional', typeHint: 'string' },
    { arityType: 'optional', typeHint: 'string' },
    { arityType: 'optional', typeHint: 'string' },
    { arityType: 'optional', typeHint: 'string' },
  ],
  <T extends XPathNode>(
    context: LocationPathEvaluation<T>,
    [instanceExpr, searchTypeExpr, columnsExpr, searchTextExpr, filterColExpr, filterTextExpr]:
      readonly EvaluableArgument[],
  ): boolean => {
    const instanceId = instanceExpr!.evaluate(context).toString();
    const doc = context.contextDocument as unknown as InstanceDocumentNode;
    const secondaryDoc: InstanceXPathNode | null = doc.secondaryInstances?.get(instanceId) ?? null;
    if (secondaryDoc === null || secondaryDoc.kind !== 'document') return false;

    // 1-arg form: no filter criteria — every row is a match.
    if (searchTypeExpr === undefined) return true;

    const searchTypeRaw = searchTypeExpr.evaluate(context).toString();
    if (!isSearchType(searchTypeRaw) || columnsExpr === undefined || searchTextExpr === undefined) {
      // Unrecognized/incomplete shape — fail closed rather than guess.
      return false;
    }

    // Predicate evaluation ([Symbol.iterator] in LocationPathEvaluator.evaluateNodes)
    // calls us once per candidate node, with `context.contextNodes` as a
    // singleton set containing exactly that node — see LocationPathEvaluator.ts.
    const contextNode = context.contextNodes.values().next().value;
    if (contextNode === undefined) return false;
    const contextItem = contextNode as unknown as InstanceXPathNode;
    if (contextItem.kind !== 'element') return false;
    const itemNode = contextItem.node;

    const columns = columnsExpr
      .evaluate(context)
      .toString()
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    const searchText = searchTextExpr.evaluate(context).toString();

    const columnMatches = columns.some((col) => {
      const child = itemNode.children.find((c) => c.name === col);
      const value = child === undefined ? null : nodeValueAsString(child);
      return value !== null && matchesSearchType(searchTypeRaw, value, searchText);
    });
    if (!columnMatches) return false;

    if (filterColExpr === undefined || filterTextExpr === undefined) return true;

    const filterCol = filterColExpr.evaluate(context).toString();
    const filterText = filterTextExpr.evaluate(context).toString();
    const filterChild = itemNode.children.find((c) => c.name === filterCol);
    const filterValue = filterChild === undefined ? null : nodeValueAsString(filterChild);
    return filterValue === filterText;
  },
);
