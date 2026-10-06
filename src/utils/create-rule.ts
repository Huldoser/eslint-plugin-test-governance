import type { TSESLint } from '@typescript-eslint/utils';
import { analyze, type Analysis } from './analyze.ts';
import { resolveOptions, type ResolvedOptions } from './options.ts';

export const REPO_URL = 'https://github.com/Huldoser/eslint-plugin-test-governance';

/** Rules take no options of their own: everything is shared through `settings['test-governance']`. */
export type RuleOptions = [];

export interface RuleDocs {
  description: string;
  recommended: 'error' | 'warn';
  url: string;
}

export type Rule<MessageIds extends string> = TSESLint.RuleModule<MessageIds, RuleOptions, RuleDocs> & {
  meta: { docs: RuleDocs };
};

export interface RuleDefinition<MessageIds extends string> {
  name: string;
  meta: Omit<TSESLint.RuleMetaData<MessageIds, RuleDocs>, 'docs' | 'schema' | 'defaultOptions'> & {
    docs: Omit<RuleDocs, 'url'>;
  };
  check(
    context: Readonly<TSESLint.RuleContext<MessageIds, RuleOptions>>,
    analysis: Analysis,
    options: ResolvedOptions,
  ): void;
}

/**
 * Builds a rule that reads its options from `settings['test-governance']`.
 * `check` runs once per file with the shared analysis.
 */
export function createRule<MessageIds extends string>(definition: RuleDefinition<MessageIds>): Rule<MessageIds> {
  return {
    meta: {
      ...definition.meta,
      docs: { ...definition.meta.docs, url: `${REPO_URL}/blob/main/docs/rules/${definition.name}.md` },
      schema: [],
    },
    defaultOptions: [],
    create(context) {
      const options = resolveOptions(context.settings);
      return {
        'Program:exit'() {
          definition.check(context, analyze(context.sourceCode, options), options);
        },
      };
    },
  };
}
