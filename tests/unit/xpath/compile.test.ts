/**
 * Unit tests: compileXPath / CompiledExpression (Slice 5 — Phase 3 handoff)
 *
 * Spec requirement (Slice 5):
 *   - compileXPath(expr) parses once and returns a CompiledExpression handle.
 *   - CompiledExpression.evaluate(ctx?) produces the same result as evaluateXPath.
 *   - The handle is reusable: calling evaluate() multiple times with different
 *     contexts returns the correct result for each context.
 *   - Compiling a syntactically invalid expression throws synchronously.
 *   - compileXPath is exported from src/xpath/index.ts (the sole XPath boundary).
 *
 * These tests must stay green (no it.fails) — they are the acceptance gate for
 * the Phase 3 handoff point. DAG / DataBinding tests remain Phase 3 backlog.
 */

import { describe, it, expect } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import {
  compileXPath,
  evaluateXPath,
  type CompiledExpression,
  type EvaluationContext,
} from "../../../src/xpath/index.ts";
import type { XmldomNode } from "../../../src/xpath/adapter/XmldomXPathAdapter.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseXml(xml: string): XmldomNode {
  return new DOMParser().parseFromString(xml, "text/xml") as unknown as XmldomNode;
}

function ctx(doc: XmldomNode, contextNode?: XmldomNode): EvaluationContext {
  return {
    instance: doc,
    contextNode: contextNode ?? doc,
  };
}

// ---------------------------------------------------------------------------
// Basic compilation
// ---------------------------------------------------------------------------
describe("compileXPath — basic compilation", () => {
  it("returns a CompiledExpression handle", () => {
    const h: CompiledExpression = compileXPath("1 + 2");
    expect(h).toBeDefined();
    expect(typeof h.evaluate).toBe("function");
  });

  it("exposes source expression on .source", () => {
    const h = compileXPath("string-length('hello')");
    expect(h.source).toBe("string-length('hello')");
  });

  it("compiled handle evaluates numeric literal", () => {
    const h = compileXPath("42");
    expect(h.evaluate()).toBe(42);
  });

  it("compiled handle evaluates arithmetic expression", () => {
    const h = compileXPath("1 + 2");
    expect(h.evaluate()).toBe(3);
  });

  it("compiled handle evaluates string function", () => {
    const h = compileXPath("string-length('hello')");
    expect(h.evaluate()).toBe(5);
  });

  it("compiled handle evaluates boolean expression", () => {
    const h = compileXPath("3 > 2");
    expect(h.evaluate()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reusability — same handle, multiple evaluations
// ---------------------------------------------------------------------------
describe("compileXPath — reusable handle", () => {
  it("evaluates the same constant expression twice and returns the same value", () => {
    const h = compileXPath("7 * 6");
    expect(h.evaluate()).toBe(42);
    expect(h.evaluate()).toBe(42);
  });

  it("evaluates with different context nodes and returns correct value each time", () => {
    const doc1 = parseXml("<root><val>10</val></root>");
    const doc2 = parseXml("<root><val>20</val></root>");

    const h = compileXPath("string(/root/val)");

    expect(h.evaluate(ctx(doc1))).toBe("10");
    expect(h.evaluate(ctx(doc2))).toBe("20");
  });

  it("two compilations of same expression produce independent handles", () => {
    const h1 = compileXPath("1 + 1");
    const h2 = compileXPath("1 + 1");
    expect(h1).not.toBe(h2); // distinct objects
    expect(h1.evaluate()).toBe(2);
    expect(h2.evaluate()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Result parity with evaluateXPath
// ---------------------------------------------------------------------------
describe("compileXPath — parity with evaluateXPath", () => {
  it("compile → evaluate matches evaluateXPath for arithmetic", () => {
    const h = compileXPath("2 * 3 + 1");
    expect(h.evaluate()).toBe(evaluateXPath("2 * 3 + 1"));
  });

  it("compile → evaluate matches evaluateXPath for DOM path", () => {
    const doc = parseXml("<data><x>hello</x></data>");
    const c = ctx(doc);
    const h = compileXPath("string(/data/x)");
    expect(h.evaluate(c)).toBe(evaluateXPath("string(/data/x)", c));
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe("compileXPath — error handling", () => {
  it("throws synchronously on invalid expression", () => {
    expect(() => compileXPath("1 ++ 2")).toThrow();
  });

  it("throws synchronously on unclosed string literal", () => {
    expect(() => compileXPath("'unterminated")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// XForms functions work through compiled handle
// ---------------------------------------------------------------------------
describe("compileXPath — XForms/JavaRosa functions", () => {
  it("if() evaluates correctly via compiled handle", () => {
    const h = compileXPath("if(true(), 'yes', 'no')");
    expect(h.evaluate()).toBe("yes");
  });

  it("boolean-from-string() via compiled handle", () => {
    const h = compileXPath("boolean-from-string('true')");
    expect(h.evaluate()).toBe(true);
  });

  it("selected() via compiled handle", () => {
    const h = compileXPath("selected('a b c', 'b')");
    expect(h.evaluate()).toBe(true);
  });
});
