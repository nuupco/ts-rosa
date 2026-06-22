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
  | { readonly kind: "unsupported"; readonly value: string;                          readonly displayText: string };
