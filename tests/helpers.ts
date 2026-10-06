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

/** Runs the same cases under espree and the TypeScript parser. */
export function runRule(name: string, rule: unknown, cases: Cases): void {
  for (const [label, parser] of parsers) {
    describe(label, () => {
      // ESLint 9.0 rejects `parser: undefined`, so leave the key out for espree, the default parser.
      const languageOptions = { ...(parser && { parser }), ecmaVersion: 'latest', sourceType: 'module' } as const;
      const tester = new RuleTester({ languageOptions });
      tester.run(name, rule as Parameters<RuleTester['run']>[1], cases);
    });
  }
}

/** Shared settings for a test case. */
export function settings(options: GovernanceOptions): { 'test-governance': GovernanceOptions } {
  return { 'test-governance': options };
}
