import type { TSESLint } from '@typescript-eslint/utils';
import { analyze, type Analysis } from './analyze.ts';
import { resolveOptions, type ResolvedOptions } from './options.ts';

/** Rules take no options of their own: everything is shared through `settings['test-governance']`. */
type RuleOptions = [];

interface RuleDocs {
  description: string;
  recommended: 'error' | 'warn';
  url: string;
}

export type Rule<MessageIds extends string> = TSESLint.RuleModule<MessageIds, RuleOptions, RuleDocs> & {
  meta: { docs: RuleDocs };
};

export interface RuleDefinition<MessageIds extends string> {
  meta: Omit<TSESLint.RuleMetaData<MessageIds, RuleDocs>, 'docs' | 'schema' | 'defaultOptions'> & {
    docs: RuleDocs;
    schema: [];
  };
  create(
    context: Readonly<TSESLint.RuleContext<MessageIds, RuleOptions>>,
    analysis: Analysis,
    options: ResolvedOptions,
  ): void;
}

/**
 * Builds a rule that reads its options from `settings['test-governance']`.
 * `create` runs once per file, at the end, with the shared analysis.
 */
export function createRule<MessageIds extends string>(definition: RuleDefinition<MessageIds>): Rule<MessageIds> {
  return {
    meta: definition.meta,
    defaultOptions: [],
    create(context) {
      const options = resolveOptions(context.settings);
      return {
        'Program:exit'() {
          definition.create(context, analyze(context.sourceCode, options), options);
        },
      };
    },
  };
}
