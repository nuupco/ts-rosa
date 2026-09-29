import { Temporal } from '../../../../../platform/temporal.ts';
import {
	ISO_DATE_OR_DATE_TIME_LIKE_PATTERN,
	TIMEZONE_OFFSET_PATTERN,
	VALID_OFFSET_VALUE,
} from '../../../common/constants/datetime.ts';

export const isISODateOrDateTimeLike = (value: string) =>
	ISO_DATE_OR_DATE_TIME_LIKE_PATTERN.test(value);

/**
 * Validates a time string, accepting an optional trailing `Z` or numeric
 * UTC offset designator (e.g. `18:44:00.000Z`, `06:00:00-07:00`).
 *
 * `Temporal.PlainTime` is offset-less by spec and throws on any trailing
 * `Z`/offset, so a Z/offset suffix (now the normal serialized shape after
 * the offset-aware `time` codec change) is stripped and separately
 * validated (reusing the same offset-range validation as
 * `dateTimeFromString`) before delegating the bare time-of-day part to
 * `Temporal.PlainTime.from`, which still rejects e.g. `24:00:00` or
 * `06:60:00`.
 */
export const isValidTimeString = (value: string): boolean => {
	let timePart = value;

	if (value.endsWith('Z')) {
		timePart = value.slice(0, -1);
	} else {
		const offsetMatch = TIMEZONE_OFFSET_PATTERN.exec(value);

		if (offsetMatch != null) {
			if (!VALID_OFFSET_VALUE.test(offsetMatch[0])) {
				return false;
			}

			timePart = value.slice(0, -offsetMatch[0].length);
		}
	}

	try {
		return Temporal.PlainTime.from(timePart) != null;
	} catch {
		return false;
	}
};
