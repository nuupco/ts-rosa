/**
 * resolvePreload — pure function dispatching on jr:preload type.
 *
 * Returns the RAW STRING value a preload writes into the node, or null when the
 * preload yields nothing (matches JR: null => node left untouched).
 * Caller passes the result through cast(node.dataType, rawString).
 *
 * Source: org.javarosa.core.model.utils.QuestionPreloader (reference/javarosa)
 */

import type { PreloadProvider } from '../PreloadProvider.ts';
import { getPastPeriodDate } from '../../util/DateUtils.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as UTC "YYYY-MM-DD" — matches codecs.ts formatUtcDate. */
function formatUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse "prevperiod-<type>-<start>-<head|tail>[-<x|>][-<nAgo>]" params
 * and call getPastPeriodDate. Mirrors JR QuestionPreloader#preloadDate.
 */
function resolvePrevperiod(params: string, provider: PreloadProvider): string {
  // Strip "prevperiod-" prefix and split remainder by "-"
  const rest = params.slice('prevperiod-'.length);
  const parts = rest.split('-');

  if (parts.length < 3) {
    throw new Error(`invalid preload params for preload mode 'date': ${params}`);
  }

  const type = parts[0]!;
  const start = parts[1]!;
  const headOrTail = parts[2]!;

  let beginning: boolean;
  if (headOrTail === 'head') {
    beginning = true;
  } else if (headOrTail === 'tail') {
    beginning = false;
  } else {
    throw new Error(`invalid preload params for preload mode 'date': ${params}`);
  }

  let includeToday = false;
  if (parts.length >= 4) {
    const inc = parts[3]!;
    if (inc === 'x') {
      includeToday = true;
    } else if (inc === '') {
      includeToday = false;
    } else {
      throw new Error(`invalid preload params for preload mode 'date': ${params}`);
    }
  }

  let nAgo = 1;
  if (parts.length >= 5) {
    const n = parseInt(parts[4]!, 10);
    if (Number.isNaN(n)) {
      throw new Error(`invalid preload params for preload mode 'date': ${params}`);
    }
    nAgo = n;
  }

  const d = getPastPeriodDate(provider.now(), type, start, beginning, includeToday, nAgo);
  return formatUtcDate(d);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the raw string value for a preload node.
 *
 * @param type    Value of jr:preload (e.g. 'date', 'timestamp', 'uid', 'property').
 * @param params  Value of jr:preloadParams (may be null for 'uid').
 * @param provider  Injectable source of non-deterministic primitives.
 * @returns Raw string to pass through cast(), or null if nothing should be written.
 * @throws  Error for unsupported preload types (ADR-2: fail loudly).
 */
export function resolvePreload(
  type: string,
  params: string | null,
  provider: PreloadProvider,
): string | null {
  switch (type) {
    case 'date': {
      const p = params ?? '';
      if (p === 'today') {
        // Source: org.javarosa.core.model.utils.QuestionPreloader#preloadDate (today branch)
        return formatUtcDate(provider.now());
      } else if (p.startsWith('prevperiod-')) {
        return resolvePrevperiod(p, provider);
      } else {
        throw new Error(`invalid preload params for preload mode 'date': ${p}`);
      }
    }

    case 'timestamp': {
      if (params === 'start') {
        // Source: org.javarosa.core.model.utils.QuestionPreloader (timestamp/start)
        return provider.now().toISOString();
      }
      // timestamp/end: returns null at preload time (populated at finalize/postProcess).
      // Phase 7 NON-GOAL includes finalize — document as known gap.
      return null;
    }

    case 'uid': {
      // Source: QuestionPreloaderTest#preloader_preloadsElements
      // JR: new StringData("uuid:" + PropertyUtils.genUUID())
      return `uuid:${provider.uid()}`;
    }

    case 'property': {
      // Source: org.javarosa.core.model.utils.QuestionPreloader#preloadProperty
      if (params === null) return null;
      return provider.property(params);
    }

    default:
      throw new Error(`unsupported jr:preload type: ${type}`);
  }
}
