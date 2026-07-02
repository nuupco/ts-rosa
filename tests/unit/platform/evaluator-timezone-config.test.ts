import { describe, expect, it } from "vitest";

// Each test file gets a fresh module registry (vitest forked-pool isolation),
// so we can register platform config before the evaluator singletons are
// first constructed and observe the configured timeZoneId taking effect.
describe("Evaluator singletons honor configured platform timeZoneId", () => {
  it("XmldomEvaluator uses the configured timeZoneId when set before first evaluation", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    const { registerPlatformConfig } = await import("../../../src/platform/PlatformConfig.ts");
    registerPlatformConfig({ timeZoneId: "America/Mexico_City" });

    const { xmldomEvaluator } = await import("../../../src/xpath/evaluator/XmldomEvaluator.ts");
    expect(xmldomEvaluator.timeZone).toBe("America/Mexico_City");
  });

  it("InstanceEvaluator uses the configured timeZoneId when set before first evaluation", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    const { registerPlatformConfig } = await import("../../../src/platform/PlatformConfig.ts");
    registerPlatformConfig({ timeZoneId: "America/Mexico_City" });

    const { instanceEvaluator } = await import("../../../src/xpath/evaluator/InstanceEvaluator.ts");
    expect(instanceEvaluator.timeZone).toBe("America/Mexico_City");
  });

  it("falls back to 'UTC' when no config is registered", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();

    const { xmldomEvaluator } = await import("../../../src/xpath/evaluator/XmldomEvaluator.ts");
    expect(xmldomEvaluator.timeZone).toBe("UTC");
  });
});
