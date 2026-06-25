/**
 * DateUtils — date utility functions ported from JavaRosa DateUtils.
 *
 * Only the functions required by the Phase 7 preload surface are ported here.
 * Source: org.javarosa.core.model.utils.DateUtils (reference/javarosa).
 */

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DOW_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Compute the first or last day of a past period relative to a reference date.
 *
 * Source: org.javarosa.core.model.utils.DateUtils#getPastPeriodDate
 *
 * @param ref        Reference date (typically "today").
 * @param type       Period type: 'week' (only type supported — 'month' unimplemented in JR too).
 * @param start      Start-day of the period: 'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat'.
 * @param beginning  true = return first day of period; false = return last day.
 * @param includeToday  Whether today's date can count as the last day of the period.
 * @param nAgo       How many periods ago: 1 = most recent completed period, 0 = period in progress.
 * @returns          A Date representing the requested boundary day.
 * @throws           Error if params are invalid (mirrors JR IllegalArgumentException / RuntimeException).
 */
export function getPastPeriodDate(
  ref: Date,
  type: string,
  start: string,
  beginning: boolean,
  includeToday: boolean,
  nAgo: number,
): Date {
  if (type === 'week') {
    const target_dow = DOW_MAP[start];
    if (target_dow === undefined) {
      throw new Error(`getPastPeriodDate: invalid start day: ${start}`);
    }

    const offset = includeToday ? 1 : 0;
    // Get current day-of-week (Sunday = 0 per JS)
    const current_dow = ref.getUTCDay();

    // Faithful port of JR formula: diff = (((current_dow - target_dow) + (7 + offset)) % 7 - offset) + (7 * nAgo) - (beginning ? 0 : 6)
    const diff =
      (((current_dow - target_dow) + (7 + offset)) % 7 - offset) +
      7 * nAgo -
      (beginning ? 0 : 6);

    return new Date(ref.getTime() - diff * DAY_IN_MS);
  } else if (type === 'month') {
    // Not supported in JR either — throw to mirror JR behavior
    throw new Error('getPastPeriodDate: month period type is not supported');
  } else {
    throw new Error(`getPastPeriodDate: unsupported period type: ${type}`);
  }
}
