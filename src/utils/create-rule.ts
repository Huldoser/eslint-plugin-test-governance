import type { TSESLint } from '@typescript-eslint/utils';
import { analyze, type Analysis } from './analyze.js';
import { resolveOptions, type GovernanceOptions, type ResolvedOptions } from './options.js';
import { optionsSchema } from './schema.js';

export const REPO_URL = 'https://github.com/Huldoser/eslint-plugin-test-governance';

export type RuleOptions = [GovernanceOptions?];

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
  meta: Omit<TSESLint.RuleMetaData<MessageIds, RuleDocs, RuleOptions>, 'docs' | 'schema' | 'defaultOptions'> & {
    docs: Omit<RuleDocs, 'url'>;
  };
  check(
    context: Readonly<TSESLint.RuleContext<MessageIds, RuleOptions>>,
    analysis: Analysis,
    options: ResolvedOptions,
  ): void;
}

/**
 * Builds a rule whose options are merged over `settings['test-governance']`.
 * `check` runs once per file with the shared analysis.
 */
export function createRule<MessageIds extends string>(definition: RuleDefinition<MessageIds>): Rule<MessageIds> {
  return {
    meta: {
      ...definition.meta,
      docs: { ...definition.meta.docs, url: `${REPO_URL}/blob/main/docs/rules/${definition.name}.md` },
      schema: optionsSchema,
    },
    defaultOptions: [],
    create(context) {
      const options = resolveOptions(context.settings, context.options[0]);
      return {
        'Program:exit'() {
          definition.check(context, analyze(context.sourceCode, options), options);
        },
      };
    },
  };
}
