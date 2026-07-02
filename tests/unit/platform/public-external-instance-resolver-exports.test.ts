import { describe, expect, it } from "vitest";
import * as pkg from "../../../src/index.ts";

describe("public barrel — external secondary instance (jr:// CSV) API", () => {
  it("re-exports registerExternalInstanceResolver, getExternalInstanceResolver, and resolveExternalInstances from the package root", () => {
    expect(typeof pkg.registerExternalInstanceResolver).toBe("function");
    expect(typeof pkg.getExternalInstanceResolver).toBe("function");
    expect(typeof pkg.resolveExternalInstances).toBe("function");
  });

  it("getExternalInstanceResolver returns whatever was registered via the barrel export", () => {
    const provider = {
      resolve: (uri: string) => Promise.resolve(`content for ${uri}`),
    };
    pkg.registerExternalInstanceResolver(provider);
    expect(pkg.getExternalInstanceResolver()).toBe(provider);
  });
});
