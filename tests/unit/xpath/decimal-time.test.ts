/**
 * Unit tests — decimal-time() / isValidTimeString() offset-awareness.
 *
 * Regression coverage for the "decimal-time() rejects Z/offset-suffixed
 * time strings (NaN bug)" fix (odd/tasks/time-codec-offset-aware.md, Part
 * 2). `isValidTimeString` (src/xpath/vendor/xpath/lib/datetime/predicates.ts)
 * used to call `Temporal.PlainTime.from(value)` directly, which throws on
 * any trailing `Z`/offset designator (`PlainTime` is offset-less by spec),
 * so any offset-suffixed time (the normal shape produced by the
 * offset-aware `time` codec, Part 1) short-circuited `decimal-time()` to
 * `NaN`.
 *
 * The evaluation context's time zone defaults to 'UTC' when no
 * `registerPlatformConfig` call has been made (see
 * `src/platform/PlatformConfig.ts`), which every test below relies on.
 *
 * `decimal-time()` computes the *time-of-day fraction in the evaluation
 * context's time zone* of the instant named by the input string — i.e. the
 * input is converted to context.timeZone, then only the wall-clock
 * hour/minute/second/ms survives (the date is discarded). This is the same
 * semantics as JavaRosa's `DateUtils.decimalTimeOfLocalDay`, which converts
 * to the local zone and takes `v - Math.floor(v)` of the resulting epoch-day
 * value — i.e. it also discards the date and keeps only the local
 * time-of-day fraction. Because both approaches discard the date component
 * before taking the fraction, converting a Z/offset value across a local
 * midnight boundary and then "clamping" the date back to 1970-01-01 does
 * NOT lose information or corrupt the result: the wall-clock hour/minute/
 * second is unaffected by which calendar day it lands on. The
 * previously-flagged "convert-then-clamp" day-boundary bug therefore does
 * NOT reproduce here — see the midnight-crossing case below, whose expected
 * value is hand-derived from this same semantics and is confirmed by the
 * observed (GREEN) result.
 */

import { describe, expect, it } from 'vitest';
import { newNode } from '../../../src/model/instance/InstanceNode.ts';
import type { InstanceTree } from '../../../src/model/instance/InstanceTree.ts';
import {
  makeInstanceDocumentNode,
  wrapInstanceNode,
} from '../../../src/xpath/adapter/instance/InstanceNodeXPathAdapter.ts';
import { instanceEvaluator } from '../../../src/xpath/evaluator/InstanceEvaluator.ts';
import { XPATH_EVALUATION_RESULT } from '../../../src/xpath/vendor/xpath/evaluator/result/XPathEvaluationResult.ts';
import { isValidTimeString } from '../../../src/xpath/vendor/xpath/lib/datetime/predicates.ts';

function evaluateNumber(expr: string): number {
  const root = newNode('data');
  const tree: InstanceTree = { root, name: null };
  const doc = makeInstanceDocumentNode(tree);
  const contextNode = wrapInstanceNode(root, doc);
  return instanceEvaluator.evaluate(expr, contextNode, null, XPATH_EVALUATION_RESULT.NUMBER_TYPE)
    .numberValue;
}

describe('isValidTimeString()', () => {
  it('accepts an offset-less time (legacy shape)', () => {
    expect(isValidTimeString('06:00:00.000')).toBe(true);
  });

  it('accepts a Z-suffixed time', () => {
    expect(isValidTimeString('18:44:00.000Z')).toBe(true);
  });

  it('accepts a positive-offset time', () => {
    expect(isValidTimeString('06:00:00.000+02:00')).toBe(true);
  });

  it('accepts a negative-offset time', () => {
    expect(isValidTimeString('06:00:00.000-06:00')).toBe(true);
  });

  it('still rejects an invalid offset-less time (out-of-range hour/minute)', () => {
    expect(isValidTimeString('24:00:00.000')).toBe(false);
    expect(isValidTimeString('06:60:00.000')).toBe(false);
  });

  it('rejects an out-of-range offset', () => {
    expect(isValidTimeString('06:00:00.000-24:00')).toBe(false);
    expect(isValidTimeString('23:59:00.000-07:60')).toBe(false);
  });

  it('rejects garbage input', () => {
    expect(isValidTimeString('a')).toBe(false);
  });
});

describe('decimal-time()', () => {
  it('computes an offset-less time (legacy, must keep working)', () => {
    // 06:00:00 / 24h = 0.25 — no conversion, evaluation context is UTC.
    expect(evaluateNumber('decimal-time("06:00:00.000")')).toBeCloseTo(0.25, 10);
  });

  it('computes a Z-suffixed time (evaluation context is UTC, so no conversion)', () => {
    // 18:44:00 = 18*3600 + 44*60 = 67440s -> 67440 / 86400 = 0.780555...
    expect(evaluateNumber('decimal-time("18:44:00.000Z")')).toBeCloseTo(67440 / 86400, 10);
  });

  it('computes a positive-offset time, converting to the UTC evaluation context', () => {
    // 06:00:00+02:00 -> 04:00:00 UTC -> 4/24 = 0.16666...
    expect(evaluateNumber('decimal-time("06:00:00.000+02:00")')).toBeCloseTo(4 / 24, 10);
  });

  it('computes a negative-offset time, converting to the UTC evaluation context', () => {
    // 06:00:00-06:00 -> 12:00:00 UTC -> 12/24 = 0.5
    expect(evaluateNumber('decimal-time("06:00:00.000-06:00")')).toBeCloseTo(0.5, 10);
  });

  it('computes a midnight-crossing offset time as the local (context-timezone) time-of-day fraction', () => {
    // 23:30:00-06:00 converts to UTC as follows: local wall time 23:30 in a
    // zone that is 6 hours behind UTC means UTC is 6 hours AHEAD of that
    // wall clock, i.e. UTC = 23:30 + 06:00 = 05:30 the NEXT day.
    //
    // decimal-time() is a time-OF-DAY fraction: it keeps only the resulting
    // wall-clock hour/minute/second in the context timezone (UTC here) and
    // discards which calendar day it fell on — matching JavaRosa's
    // `decimalTimeOfLocalDay` (`v - Math.floor(v)`).
    //
    // Expected: 05:30:00 UTC -> (5*3600 + 30*60) / 86400 = 19800 / 86400
    //         = 0.229166666...
    expect(evaluateNumber('decimal-time("23:30:00.000-06:00")')).toBeCloseTo(19800 / 86400, 10);
  });

  it('rejects an invalid time string (NaN)', () => {
    expect(evaluateNumber('decimal-time("a")')).toBeNaN();
  });

  it('rejects an out-of-range offset (NaN)', () => {
    expect(evaluateNumber('decimal-time("06:00:00.000-24:00")')).toBeNaN();
  });
});
