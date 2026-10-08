import { describe, it } from 'node:test';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import type { GovernanceOptions } from '../src/index.ts';

// RuleTester registers one test per case through these hooks.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const parsers = [
  ['espree', undefined],
  ['@typescript-eslint/parser', tsParser],
] as const;

type Cases = Parameters<RuleTester['run']>[2];

/**
 * Cases are Playwright tests unless their settings name another framework: ESLint merges a case's settings
 * into these.
 */
export const PLAYWRIGHT_SETTINGS = { 'test-governance': { framework: 'playwright' } };

/** Runs the same cases under espree and the TypeScript parser. */
export function runRule(name: string, rule: unknown, cases: Cases): void {
  for (const [label, parser] of parsers) {
    describe(label, () => {
      // ESLint 9.0 rejects `parser: undefined`, so leave the key out for espree, the default parser.
      const languageOptions = { ...(parser && { parser }), ecmaVersion: 'latest', sourceType: 'module' } as const;
      const tester = new RuleTester({ languageOptions, settings: PLAYWRIGHT_SETTINGS });
      tester.run(name, rule as Parameters<RuleTester['run']>[1], cases);
    });
  }
}

/** Shared settings for a test case. */
export function settings(options: Partial<GovernanceOptions>): { 'test-governance': Partial<GovernanceOptions> } {
  return { 'test-governance': options };
}

interface CaseObject {
  code: string;
  settings?: Record<string, unknown>;
}

/** Runs every case with `options` added to its shared settings, e.g. `{ framework: 'jest' }`. */
export function withOptions<T extends CaseObject>(options: Partial<GovernanceOptions>, cases: (string | T)[]): T[] {
  return cases.map((c) => {
    const object = (typeof c === 'string' ? { code: c } : c) as T;
    const own = (object.settings?.['test-governance'] ?? {}) as Partial<GovernanceOptions>;
    return { ...object, settings: settings({ ...options, ...own }) };
  });
}
