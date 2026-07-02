import { describe, expect, it } from "vitest";

// This file intentionally does NOT rely on tests/setup.ts's provider being
// unregistered — vitest's default forked-pool isolation gives each test file
// a fresh module registry, so the module-level `_provider` slot in
// src/platform/XmlParser.ts starts out already registered by setupFiles.
// We simulate the "no provider registered" state by re-importing the module
// via vi.resetModules() so the slot resets to null before parseForm runs.

describe("parseForm without a registered XmlParser", () => {
  it("throws a clear, actionable error identifying the missing registration", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    const { parseForm } = await import("../../../src/parse/index.ts");

    expect(() => parseForm("<h:html xmlns:h='http://www.w3.org/1999/xhtml'/>")).toThrow(
      /XmlParser provider is not registered/,
    );
  });
});
