import { describe, it, expect } from "vitest";
import { AnswerResult } from "../../src/session/AnswerResult.ts";

describe("AnswerResult", () => {
  it("exposes OK", () => {
    expect(AnswerResult.OK).toBeDefined();
  });

  it("exposes REQUIRED_BUT_EMPTY", () => {
    expect(AnswerResult.REQUIRED_BUT_EMPTY).toBeDefined();
  });

  it("exposes CONSTRAINT_VIOLATED", () => {
    expect(AnswerResult.CONSTRAINT_VIOLATED).toBeDefined();
  });

  it("all three values are distinct", () => {
    const values = new Set([
      AnswerResult.OK,
      AnswerResult.REQUIRED_BUT_EMPTY,
      AnswerResult.CONSTRAINT_VIOLATED,
    ]);
    expect(values.size).toBe(3);
  });

  it("exposes RANK_INVALID, distinct from OK/REQUIRED_BUT_EMPTY/CONSTRAINT_VIOLATED", () => {
    expect(AnswerResult.RANK_INVALID).toBeDefined();
    const values = new Set([
      AnswerResult.OK,
      AnswerResult.REQUIRED_BUT_EMPTY,
      AnswerResult.CONSTRAINT_VIOLATED,
      AnswerResult.RANK_INVALID,
    ]);
    expect(values.size).toBe(4);
  });

  it("type-checks: AnswerResult members are assignable to AnswerResult type", () => {
    const ok: AnswerResult = AnswerResult.OK;
    const req: AnswerResult = AnswerResult.REQUIRED_BUT_EMPTY;
    const con: AnswerResult = AnswerResult.CONSTRAINT_VIOLATED;
    expect([ok, req, con]).toHaveLength(3);
  });
});
