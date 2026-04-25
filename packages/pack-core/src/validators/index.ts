/**
 * Validator types and registry for the validate_artifacts dispatcher.
 *
 * Each validator accepts in-memory file content and returns structured results.
 * Validators must never access the filesystem — all content is passed via args.
 */

/** A single violation found by a validator. */
export interface Violation {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  line: number;
  message: string;
  fix?: string;
}

/** Result from running a validator on a single file. */
export interface ValidatorResult {
  path: string;
  status: 'pass' | 'fail' | 'skipped';
  violations: Violation[];
  reason?: string;
}

/**
 * A validator function: given a file path + content, returns a result.
 * Validators MUST NOT throw — they return `status: 'skipped'` on failure.
 */
export type ValidatorFn = (
  path: string,
  content: string,
) => Promise<ValidatorResult>;
