/**
 * Whether a failed coverage run should be tried once more: only a coverage threshold may have failed,
 * so no test did.
 */
export function shouldRetry(output: string): boolean;
