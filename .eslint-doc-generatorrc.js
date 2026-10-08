// @ts-check
import prettier from 'prettier';

/** @type {import('eslint-doc-generator').GenerateOptions} */
export default {
  ruleDocTitleFormat: 'desc-parens-prefix-name',
  ruleListColumns: ['name', 'description', 'configsError', 'configsWarn', 'fixable', 'hasSuggestions'],
  // The framework configs turn on the same rules as `recommended`; the README explains them.
  ignoreConfig: ['playwright', 'jest', 'vitest'],
  // Options are shared by all rules and documented once in the README.
  ruleDocSectionOptions: false,
  urlConfigs: 'https://github.com/Huldoser/eslint-plugin-test-governance#usage',
  // Format generated docs with the repo's Prettier config, so `format:check` and `docs:check` agree.
  postprocess: async (content, path) =>
    prettier.format(content, { ...(await prettier.resolveConfig(path)), parser: 'markdown' }),
};
