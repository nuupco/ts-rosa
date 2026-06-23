/**
 * AnswerValue — discriminated union representing a typed XForms answer.
 *
 * Shape: { kind: DataType; value: <type-specific>; displayText: string }
 * Satisfies the structural contract expected by matchers.ts (value + displayText).
 */

/** Geographic coordinate point */
export type GeoPoint = {
  readonly lat: number;
  readonly lon: number;
  readonly alt: number;
  readonly acc: number;
};

/**
 * A single select-choice token.
 * Full SelectChoice (label/index) is a Phase-5 concern.
 */
export type SelectChoiceRef = string;

export type AnswerValue =
  | { readonly kind: "string";      readonly value: string;                          readonly displayText: string }
  | { readonly kind: "int";         readonly value: number;                          readonly displayText: string }
  | { readonly kind: "decimal";     readonly value: number;                          readonly displayText: string }
  | { readonly kind: "boolean";     readonly value: boolean;                         readonly displayText: string }
  | { readonly kind: "date";        readonly value: Date;                            readonly displayText: string }
  | { readonly kind: "time";        readonly value: Date;                            readonly displayText: string }
  | { readonly kind: "dateTime";    readonly value: Date;                            readonly displayText: string }
  | { readonly kind: "selectOne";   readonly value: SelectChoiceRef;                 readonly displayText: string }
  | { readonly kind: "selectMulti"; readonly value: readonly SelectChoiceRef[];      readonly displayText: string }
  | { readonly kind: "geopoint";    readonly value: GeoPoint;                        readonly displayText: string }
  | { readonly kind: "binary";      readonly value: string;                          readonly displayText: string }
  /**
   * long: JavaRosa LongData. JS number is safe up to 2^53 — sufficient for
   * XForms long values in practice. bigint is intentionally avoided for
   * consistency with int/decimal.
   */
  | { readonly kind: "long";        readonly value: number;                          readonly displayText: string }
  /**
   * geoshape: JavaRosa GeoShapeData — a polygon represented as an ordered list
   * of GeoPoint values. Serialised as points separated by ';', each point as
   * "lat lon alt acc" (JavaRosa GeoShape wire format).
   */
  | { readonly kind: "geoshape";    readonly value: readonly GeoPoint[];             readonly displayText: string }
  /**
   * geotrace: JavaRosa GeoTraceData — a polyline/trace represented as an ordered
   * list of GeoPoint values. Same wire format as geoshape.
   */
  | { readonly kind: "geotrace";    readonly value: readonly GeoPoint[];             readonly displayText: string }
  /**
   * uncast: raw string without a resolved type — mirrors JavaRosa UncastData.
   * Used as an intermediary before the cast/bind pass. NOT produced from any
   * xsd:type attribute; never stored as a final answer value in normal flow.
   */
  | { readonly kind: "uncast";      readonly value: string;                          readonly displayText: string }
  | { readonly kind: "unsupported"; readonly value: string;                          readonly displayText: string };
