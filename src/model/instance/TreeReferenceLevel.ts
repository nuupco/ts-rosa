import { INDEX_UNBOUND, type Multiplicity } from './multiplicity';

// Phase 1 placeholder; real XPathExpression union arrives Phase 2
export type XPathPredicate = unknown;

export type TreeReferenceLevel = {
  readonly name: string;
  readonly multiplicity: Multiplicity;
  readonly predicates: readonly XPathPredicate[];
};

export function level(name: string, multiplicity: Multiplicity = INDEX_UNBOUND): TreeReferenceLevel {
  return Object.freeze({ name, multiplicity, predicates: Object.freeze([]) });
}
