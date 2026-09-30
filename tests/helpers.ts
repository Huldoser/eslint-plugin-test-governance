import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import type { GovernanceOptions } from '../src/index.js';

const parsers = [
  ['espree', undefined],
  ['@typescript-eslint/parser', tsParser],
] as const;

type Cases = Parameters<RuleTester['run']>[2];

/** Runs the same cases under espree and the TypeScript parser. */
export function runRule(name: string, rule: unknown, cases: Cases): void {
  for (const [label, parser] of parsers) {
    describe(label, () => {
      const tester = new RuleTester({ languageOptions: { parser, ecmaVersion: 'latest', sourceType: 'module' } });
      tester.run(name, rule as Parameters<RuleTester['run']>[1], cases);
    });
  }
}

/** Shared settings for a test case. */
export function settings(options: GovernanceOptions): { 'test-governance': GovernanceOptions } {
  return { 'test-governance': options };
}
