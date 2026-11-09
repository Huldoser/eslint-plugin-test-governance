// @ts-check
import prettier from 'prettier';
import { basename } from 'node:path';
import testGovernance from './dist/index.js';

/** @type {import('eslint-doc-generator').GenerateOptions} */
export default {
  ruleDocTitleFormat: 'desc-parens-prefix-name',
  ruleListColumns: ['name', 'description'],
  ruleDocNotices: ['configs'],
  // The generator requires config labels before postprocessing its notices.
  configEmoji: Object.keys(testGovernance.configs).map((name) => [name, `config-${name}`]),
  // Options are shared by all rules and documented in docs/configuration.md.
  ruleDocSectionOptions: false,
  urlConfigs: 'https://github.com/Huldoser/eslint-plugin-test-governance#usage',
  postprocess: async (content, filePath) => {
    const name = basename(filePath, '.md');
    const rule = testGovernance.rules[name];
    if (rule) {
      const severity = testGovernance.configs.playwright.rules[`test-governance/${name}`];
      const behavior = rule.meta?.fixable
        ? 'Supports automatic fixes with `--fix`.'
        : rule.meta?.hasSuggestions
          ? 'Offers editor suggestions; these do not run with `--fix`.'
          : 'Reports problems without fixes.';
      const notice = `Enabled as **${severity}** in every [framework config](../../README.md#frameworks).\n\n${behavior}\n\n`;
      content = content.replace(/^.*This rule (?:is enabled|_warns_).*$/m, notice.trimEnd());
    }
    return prettier.format(content.replaceAll('\u00a0', ''), {
      ...(await prettier.resolveConfig(filePath)),
      parser: 'markdown',
    });
  },
};
