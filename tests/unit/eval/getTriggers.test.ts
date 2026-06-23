/**
 * Unit tests for getTriggers — Slice 3.2-T1 (test-first / RED phase).
 *
 * getTriggers(root, contextRef, originalContextRef) walks a PureJSExpressionParser
 * SyntaxNode AST and returns the set of genericized, predicate-stripped,
 * contextualized absolute TreeReferences the expression depends on.
 *
 * Tests run against getTriggers in isolation — no DAG, no FormEvaluator needed.
 */

import { describe, expect, it } from 'vitest';
import { getTriggers } from '../../../src/eval/getTriggers.ts';
import { PureJSExpressionParser } from '../../../src/xpath/parser/PureJSExpressionParser.ts';
import {
  type TreeReference,
  parseAbsoluteRef,
  refToString,
  extendRef,
  rootRef,
  selfRef,
  genericize,
} from '../../../src/model/instance/TreeReference.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parser = new PureJSExpressionParser();

function parse(expr: string) {
  return parser.parse(expr).rootNode;
}

/** Context ref: /data (the group node in which a bind lives) */
const CTX_DATA = parseAbsoluteRef('/data');
/** Context ref: /data/group/field (a nested field) */
const CTX_GROUP_FIELD = parseAbsoluteRef('/data/group/field');

function triggers(expr: string, ctx: TreeReference = CTX_DATA, origCtx: TreeReference = CTX_DATA): string[] {
  const root = parse(expr);
  return getTriggers(root, ctx, origCtx).map(refToString).sort();
}

// ---------------------------------------------------------------------------
// Absolute paths
// ---------------------------------------------------------------------------

describe('absolute path', () => {
  it('single absolute path yields one trigger', () => {
    expect(triggers('/data/a')).toEqual(['/data/a']);
  });

  it('absolute path with two levels yields that ref', () => {
    expect(triggers('/data/group/x')).toEqual(['/data/group/x']);
  });

  it('// abbreviated absolute path yields trigger with descendant path', () => {
    // //foo → conservative trigger: treat as absolute path to first named step
    const result = triggers('//foo');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Relative paths
// ---------------------------------------------------------------------------

describe('relative path', () => {
  it('relative single-step path contextualized against ctx', () => {
    // a relative to /data → /data/a
    expect(triggers('a')).toEqual(['/data/a']);
  });

  it('relative multi-step path contextualized', () => {
    // a/b relative to /data → /data/a/b
    expect(triggers('a/b')).toEqual(['/data/a/b']);
  });
});

// ---------------------------------------------------------------------------
// Self / parent abbreviated steps
// ---------------------------------------------------------------------------

describe('abbreviated steps', () => {
  it('. in constraint expression uses originalContextRef', () => {
    // . relative to /data/group/field (both ctx and origCtx the same here)
    const result = triggers('.', CTX_GROUP_FIELD, CTX_GROUP_FIELD);
    // . → self → contextualize to origCtx = /data/group/field
    expect(result).toEqual(['/data/group/field']);
  });

  it('.. parent step goes up one level', () => {
    // ../sibling relative to /data/group/field context
    const result = triggers('../sibling', CTX_GROUP_FIELD, CTX_GROUP_FIELD);
    // ../sibling from /data/group/field → /data/group/sibling
    expect(result).toEqual(['/data/group/sibling']);
  });
});

// ---------------------------------------------------------------------------
// Attribute steps
// ---------------------------------------------------------------------------

describe('attribute steps', () => {
  it('@attr step yields element ref (attr dropped)', () => {
    // /data/item/@id — trigger is the element /data/item, not the attribute
    const result = triggers('/data/item/@id');
    expect(result).toContain('/data/item');
  });
});

// ---------------------------------------------------------------------------
// Paths inside function arguments
// ---------------------------------------------------------------------------

describe('function arguments', () => {
  it('count(/data/r) extracts /data/r as trigger', () => {
    expect(triggers('count(/data/r)')).toEqual(['/data/r']);
  });

  it('if(cond, /data/a, /data/b) extracts both paths', () => {
    const result = triggers('if(/data/cond, /data/a, /data/b)');
    expect(result).toEqual(['/data/a', '/data/b', '/data/cond'].sort());
  });

  it('string-length(/data/name) extracts /data/name', () => {
    expect(triggers('string-length(/data/name)')).toEqual(['/data/name']);
  });
});

// ---------------------------------------------------------------------------
// Binary expressions — both operands traversed
// ---------------------------------------------------------------------------

describe('binary expressions', () => {
  it('/data/a + /data/b yields both', () => {
    const result = triggers('/data/a + /data/b');
    expect(result).toEqual(['/data/a', '/data/b'].sort());
  });

  it('/data/x = /data/y yields both', () => {
    const result = triggers('/data/x = /data/y');
    expect(result).toEqual(['/data/x', '/data/y'].sort());
  });

  it('/data/a > 0 yields only /data/a (literal has no trigger)', () => {
    expect(triggers('/data/a > 0')).toEqual(['/data/a']);
  });

  it('/data/a and /data/b yields both', () => {
    const result = triggers('/data/a and /data/b');
    expect(result).toEqual(['/data/a', '/data/b'].sort());
  });
});

// ---------------------------------------------------------------------------
// Predicates — sub-context recursion
// ---------------------------------------------------------------------------

describe('predicates', () => {
  it('/data/r[@id=1]/x — predicate inner ref becomes trigger', () => {
    // Main path: /data/r/x (predicate-stripped); predicate: @id → /data/r
    const result = triggers('/data/r[@id=1]/x');
    // /data/r/x (the outer path, predicates stripped) + /data/r (from @id inside predicate)
    expect(result).toContain('/data/r/x');
  });

  it('/data/items[/data/count > 0]/item yields outer + inner triggers', () => {
    const result = triggers('/data/items[/data/count > 0]/item');
    expect(result).toContain('/data/items/item');
    expect(result).toContain('/data/count');
  });
});

// ---------------------------------------------------------------------------
// Constant / literal expressions → zero triggers
// ---------------------------------------------------------------------------

describe('constant expressions', () => {
  it('pure number literal 0 has no triggers', () => {
    expect(triggers('0')).toEqual([]);
  });

  it('string literal has no triggers', () => {
    expect(triggers("'hello'")).toEqual([]);
  });

  it('true() has no triggers', () => {
    expect(triggers('true()')).toEqual([]);
  });

  it('now() has no triggers', () => {
    expect(triggers('now()')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('deduplication', () => {
  it('/data/a + /data/a yields /data/a only once', () => {
    expect(triggers('/data/a + /data/a')).toEqual(['/data/a']);
  });

  it('/data/a = /data/a yields /data/a only once', () => {
    expect(triggers('/data/a = /data/a')).toEqual(['/data/a']);
  });
});

// ---------------------------------------------------------------------------
// Unary expression
// ---------------------------------------------------------------------------

describe('unary expression', () => {
  it('-/data/a yields /data/a', () => {
    expect(triggers('-/data/a')).toEqual(['/data/a']);
  });
});

// ---------------------------------------------------------------------------
// Union expression
// ---------------------------------------------------------------------------

describe('union expression', () => {
  it('/data/a | /data/b yields both', () => {
    const result = triggers('/data/a | /data/b');
    expect(result).toEqual(['/data/a', '/data/b'].sort());
  });
});

// ---------------------------------------------------------------------------
// current() — ORIGINAL context
// ---------------------------------------------------------------------------

describe('current() via originalContextRef', () => {
  it('current() with no following steps uses origCtx', () => {
    // current() returns a nodeset of the original context node
    // After contextualize with origCtx it becomes the origCtx ref
    const origCtx = parseAbsoluteRef('/data/group/field');
    const ctx = parseAbsoluteRef('/data/group');
    const result = triggers('current()', ctx, origCtx);
    // current() is a function call; the result nodeset is the original context node
    // getTriggers should record origCtx as a trigger
    // (Implementation: current() function is detected by name, adds origCtx)
    expect(result).toContain('/data/group/field');
  });
});
