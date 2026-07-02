import { describe, expect, it, beforeEach } from "vitest";
import {
  getPlatformTimeZoneId,
  registerPlatformConfig,
} from "../../../src/platform/PlatformConfig.ts";

describe("PlatformConfig — timeZoneId", () => {
  beforeEach(() => {
    // Reset to default between tests by registering an empty config.
    registerPlatformConfig({});
  });

  it("defaults to 'UTC' when no config has been registered", () => {
    expect(getPlatformTimeZoneId()).toBe("UTC");
  });

  it("registerPlatformConfig({ timeZoneId }) overrides the default", () => {
    registerPlatformConfig({ timeZoneId: "America/Mexico_City" });
    expect(getPlatformTimeZoneId()).toBe("America/Mexico_City");
  });
});
