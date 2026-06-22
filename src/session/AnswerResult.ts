/**
 * Result of answering a question in a form session.
 *
 * Member names mirror JavaRosa's FormEntryController answer constants exactly,
 * enabling zero-rename porting of JavaRosa test code.
 *
 * Lives in src/ (not tests/) on purpose: this is a real public domain type of
 * the engine, not a test-only helper. Do not move it into the harness during
 * cleanups — the Scenario stubs and the future engine both depend on it.
 */
export enum AnswerResult {
  OK = "OK",
  REQUIRED_BUT_EMPTY = "REQUIRED_BUT_EMPTY",
  CONSTRAINT_VIOLATED = "CONSTRAINT_VIOLATED",
}
