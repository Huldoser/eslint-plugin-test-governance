import { createRule } from '../utils/create-rule.ts';

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce a maximum retry count for tests',
      recommended: 'off',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/limit-retries.md',
    },
    schema: [],
    messages: {
      excessiveRetries: 'This retry count of {{count}} exceeds the configured maximum of {{max}}.',
    },
  },
  create(context, analysis, options) {
    const reported = new Set<number>();
    for (const { node, count } of analysis.retryCounts) {
      if (count > options.maxRetries && !reported.has(node.range[0])) {
        reported.add(node.range[0]);
        context.report({
          node,
          messageId: 'excessiveRetries',
          data: { count, max: options.maxRetries },
        });
      }
    }
  },
});
