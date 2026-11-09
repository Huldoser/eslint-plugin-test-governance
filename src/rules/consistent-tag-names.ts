import type { TagOccurrence } from '../utils/analyze.ts';
import { createRule } from '../utils/create-rule.ts';
import { isTagState } from '../utils/options.ts';
import { editDistance, typoThreshold } from '../utils/distance.ts';

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow tag names that differ in case or look like typos',
      recommended: 'warn',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/consistent-tag-names.md',
    },
    fixable: 'code',
    schema: [],
    messages: {
      tagCase: '`{{found}}` should be written `{{expected}}`.',
      tagTypo: '`{{found}}` looks like a typo of `{{expected}}`.',
    },
  },
  create(context, analysis, options) {
    // State tags first, so a tag near both a state tag and a known tag is read as the state's.
    const checkedTags = [...options.states.filter(isTagState).map((s) => s.tag), ...options.knownTags];
    const spelled = new Set<string>();

    for (const subject of analysis.subjects) {
      for (const occurrence of subject.tags) checkSpelling(occurrence);
    }

    function checkSpelling(occurrence: TagOccurrence): void {
      const { tag, range } = occurrence;
      // A constant used in several titles, as `` `buys ${TAG}` ``, is one place to fix, so one report.
      const key = `${occurrence.node.range[0]}:${range?.[0]}:${tag}`;
      if (spelled.has(key)) return;
      spelled.add(key);
      // A Vitest tag name is written without its `@`, so show it, and fix it, the same way.
      const written = (name: string): string => (occurrence.plain ? name.slice(1) : name);
      if (checkedTags.includes(tag)) return;
      const lower = tag.toLowerCase();
      const sameLetters = checkedTags.find((checked) => checked.toLowerCase() === lower);
      if (sameLetters) {
        context.report({
          node: occurrence.node,
          messageId: 'tagCase',
          data: { found: written(tag), expected: written(sameLetters) },
          fix: range && ((fixer) => fixer.replaceTextRange(range, written(sameLetters))),
        });
        return;
      }
      // A typo changes, adds, drops or swaps a letter or two. A tag that is two or more letters
      // shorter or longer, like `@unquarantined` next to `@quarantined`, is a different word.
      const near = checkedTags.find((checked) => {
        const expected = checked.toLowerCase();
        return (
          Math.abs(lower.length - expected.length) < 2 &&
          editDistance(lower, expected) <= typoThreshold(expected.length - 1)
        );
      });
      if (near) {
        context.report({
          node: occurrence.node,
          messageId: 'tagTypo',
          data: { found: written(tag), expected: written(near) },
        });
      }
    }
  },
});
