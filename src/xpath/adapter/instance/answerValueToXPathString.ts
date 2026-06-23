/**
 * answerValueToXPathString — serialize an AnswerValue to the XPath string-value
 * that JavaRosa would produce when evaluating this node's text content.
 *
 * Rules:
 *  - null → '' (no value)
 *  - string/uncast/unsupported → raw string value
 *  - int/decimal/long → String(value)  (number → string without trailing .0)
 *  - boolean → 'true' | 'false'
 *  - date/time/dateTime → ISO string (displayText is already the serialized form)
 *  - selectOne → the choice token
 *  - selectMulti → space-joined choice tokens
 *  - geopoint → "lat lon alt acc" (JavaRosa wire format)
 *  - geoshape/geotrace → ';'-joined "lat lon alt acc" points
 *  - binary → raw string (base64 URI)
 */

import type { AnswerValue } from '../../../model/data/AnswerValue.ts';

export function answerValueToXPathString(value: AnswerValue | null): string {
  if (value === null) {
    return '';
  }

  switch (value.kind) {
    case 'string':
    case 'uncast':
    case 'unsupported':
    case 'binary':
      return value.value;

    case 'int':
    case 'long':
    case 'decimal':
      return String(value.value);

    case 'boolean':
      return value.value ? 'true' : 'false';

    case 'date':
    case 'time':
    case 'dateTime':
      // displayText is the canonically serialized form (e.g. "2024-01-15")
      return value.displayText;

    case 'selectOne':
      return value.value;

    case 'selectMulti':
      return value.value.join(' ');

    case 'geopoint': {
      const { lat, lon, alt, acc } = value.value;
      return `${lat} ${lon} ${alt} ${acc}`;
    }

    case 'geoshape':
    case 'geotrace':
      return value.value
        .map(({ lat, lon, alt, acc }) => `${lat} ${lon} ${alt} ${acc}`)
        .join(';');
  }
}
