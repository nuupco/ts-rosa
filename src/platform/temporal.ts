/**
 * Temporal — native-first seam over `temporal-polyfill`.
 *
 * Environments that already ship the `Temporal` global (newer JS engines)
 * skip loading/executing the polyfill's implementation entirely; engines
 * without it (e.g. Hermes/React Native today) fall back transparently.
 */

import { Temporal as TemporalPolyfill } from "temporal-polyfill";

declare global {
  // eslint-disable-next-line no-var
  var Temporal: typeof TemporalPolyfill | undefined;
}

export const Temporal: typeof TemporalPolyfill = globalThis.Temporal ?? TemporalPolyfill;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Temporal {
  export type PlainDate = TemporalPolyfill.PlainDate;
  export type PlainDateTime = TemporalPolyfill.PlainDateTime;
  export type PlainTime = TemporalPolyfill.PlainTime;
  export type ZonedDateTime = TemporalPolyfill.ZonedDateTime;
  export type TimeZoneLike = TemporalPolyfill.TimeZoneLike;
}
