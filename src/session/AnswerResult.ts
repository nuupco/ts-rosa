/**
 * Result of answering a question in a form session.
 *
 * Member names mirror JavaRosa's FormEntryController answer constants exactly,
 * enabling zero-rename porting of JavaRosa test code.
 */
export enum AnswerResult {
  OK = "OK",
  REQUIRED_BUT_EMPTY = "REQUIRED_BUT_EMPTY",
  CONSTRAINT_VIOLATED = "CONSTRAINT_VIOLATED",
}
