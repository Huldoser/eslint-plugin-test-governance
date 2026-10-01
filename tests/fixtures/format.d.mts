import type { ESLint } from 'eslint';

export function formatResults(results: ESLint.LintResult[], cwd: string): string;
