import { INDEX_UNBOUND, type Multiplicity } from './multiplicity';
import { level, type TreeReferenceLevel } from './TreeReferenceLevel';

export type RefContext = 'absolute' | 'inherited' | 'original' | 'instance';

export type TreeReference = {
  readonly refLevel: number;
  readonly contextType: RefContext;
  readonly instanceName: string | null;
  readonly levels: readonly TreeReferenceLevel[];
};

export const REF_ABSOLUTE = -1;

function makeRef(
  refLevel: number,
  contextType: RefContext,
  levels: readonly TreeReferenceLevel[],
  instanceName: string | null = null,
): TreeReference {
  return Object.freeze({ refLevel, contextType, instanceName, levels: Object.freeze([...levels]) });
}

export function rootRef(): TreeReference {
  return makeRef(REF_ABSOLUTE, 'absolute', []);
}

export function selfRef(): TreeReference {
  return makeRef(0, 'original', []);
}

export function extendRef(ref: TreeReference, name: string, mult?: Multiplicity): TreeReference {
  const newLevel = level(name, mult ?? INDEX_UNBOUND);
  return makeRef(ref.refLevel, ref.contextType, [...ref.levels, newLevel], ref.instanceName);
}

export function parentOf(ref: TreeReference): TreeReference {
  return makeRef(ref.refLevel, ref.contextType, ref.levels.slice(0, -1), ref.instanceName);
}

export function genericize(ref: TreeReference): TreeReference {
  const genericLevels = ref.levels.map((lvl) =>
    level(lvl.name, INDEX_UNBOUND),
  );
  return makeRef(ref.refLevel, ref.contextType, genericLevels, ref.instanceName);
}

export function contextualize(ref: TreeReference, context: TreeReference): TreeReference {
  // Anchor a relative ref onto an absolute context by prepending context levels
  const combined = [...context.levels, ...ref.levels];
  return makeRef(REF_ABSOLUTE, 'absolute', combined, context.instanceName);
}

export function refEquals(a: TreeReference, b: TreeReference): boolean {
  if (a.refLevel !== b.refLevel) return false;
  if (a.contextType !== b.contextType) return false;
  if (a.instanceName !== b.instanceName) return false;
  if (a.levels.length !== b.levels.length) return false;
  for (let i = 0; i < a.levels.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (a.levels[i]!.name !== b.levels[i]!.name) return false;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (a.levels[i]!.multiplicity !== b.levels[i]!.multiplicity) return false;
  }
  return true;
}

export function refToString(ref: TreeReference): string {
  if (ref.levels.length === 0) return ref.refLevel === REF_ABSOLUTE ? '/' : '.';
  const segments = ref.levels.map((lvl) => {
    const mult = lvl.multiplicity >= 0 ? `[${lvl.multiplicity}]` : '';
    return `${lvl.name}${mult}`;
  });
  return (ref.refLevel === REF_ABSOLUTE ? '/' : '') + segments.join('/');
}

/**
 * Parses a slash-separated absolute path (optionally with `[N]` positional
 * predicates) into a `TreeReference` with concrete, 0-indexed multiplicities.
 *
 * sdd/setvalue-parity design Decision 7 (accepted breaking change, no
 * deprecation path): a predicate body that is not a positive integer literal
 * (e.g. `[position()=1]`, `[@x='y']`, `[last()]`) now THROWS instead of
 * silently degrading to `INDEX_UNBOUND`. Such refs are only resolvable via
 * real XPath evaluation (the seam's `compileInstanceXPath`/`evaluateTyped`),
 * not via this parse-time string-splitting helper.
 */
export function parseAbsoluteRef(path: string): TreeReference {
  const parts = path.split('/').filter((s) => s.length > 0);
  const levels = parts.map((part) => {
    // Handle positional predicates: item[1] → (name="item", multiplicity=0)
    // XPath positions are 1-indexed; InstanceTree multiplicities are 0-indexed.
    const bracketIdx = part.indexOf('[');
    if (bracketIdx !== -1) {
      const name = part.slice(0, bracketIdx);
      const body = part.slice(bracketIdx + 1, part.length - 1);
      if (!/^[0-9]+$/.test(body)) {
        throw new Error(
          `TreeReference: unsupported predicate '[${body}]' in ref '${path}' — only positive ` +
            'integer positions are supported',
        );
      }
      const pos = parseInt(body, 10);
      return level(name, pos - 1);
    }
    return level(part, INDEX_UNBOUND);
  });
  return makeRef(REF_ABSOLUTE, 'absolute', levels);
}
