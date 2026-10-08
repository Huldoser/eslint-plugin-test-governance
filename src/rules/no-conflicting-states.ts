import { headLoc, type TagOccurrence } from '../utils/analyze.ts';
import { createRule } from '../utils/create-rule.ts';
import { isTagState } from '../utils/options.ts';
import { editDistance, typoThreshold } from '../utils/distance.ts';

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow state tags that contradict each other, differ in case or look like typos',
      recommended: 'warn',
      url: 'https://github.com/Huldoser/eslint-plugin-test-governance/blob/main/docs/rules/no-conflicting-states.md',
    },
    fixable: 'code',
    schema: [],
    messages: {
      newAndUnstable: '`{{new}}` and `{{unstable}}` are separate stages; a test should be in only one of them.',
      newSkipped:
        "`{{new}}` on a skipped test: a new test that doesn't run can't be promoted. Fix the test or drop the tag.",
      tagCase: '`{{found}}` should be written `{{expected}}`.',
      tagTypo: '`{{found}}` looks like a typo of `{{expected}}`.',
    },
  },
  create(context, analysis, options) {
    const tagStates = options.states.filter(isTagState);
    const newTag = options.states.find((s) => s.name === 'new')?.tag;
    const unstableTag = options.states.find((s) => s.name === 'unstable')?.tag;

    for (const subject of analysis.subjects) {
      for (const occurrence of subject.tags) checkSpelling(occurrence);

      if (newTag === undefined) continue;
      const own = (tag: string): TagOccurrence | undefined => subject.tags.find((t) => t.tag === tag);
      const has = (tag: string): boolean => own(tag) !== undefined || subject.inheritedTags.has(tag);
      const ownNew = own(newTag);

      if (unstableTag !== undefined && has(newTag) && has(unstableTag)) {
        const occurrence = ownNew ?? own(unstableTag);
        if (occurrence) {
          context.report({
            node: occurrence.node,
            messageId: 'newAndUnstable',
            data: { new: newTag, unstable: unstableTag },
          });
        }
      }
      if (has(newTag) && subject.skipped && (ownNew || subject.parent?.skipped !== true)) {
        context.report({
          ...(ownNew ? { node: ownNew.node } : { loc: headLoc(subject) }),
          messageId: 'newSkipped',
          data: { new: newTag },
        });
      }
    }

    function checkSpelling(occurrence: TagOccurrence): void {
      const { tag, range } = occurrence;
      if (tagStates.some((s) => s.tag === tag)) return;
      const lower = tag.toLowerCase();
      const sameLetters = tagStates.find((s) => s.tag.toLowerCase() === lower);
      if (sameLetters) {
        context.report({
          node: occurrence.node,
          messageId: 'tagCase',
          data: { found: tag, expected: sameLetters.tag },
          fix: range && ((fixer) => fixer.replaceTextRange(range, sameLetters.tag)),
        });
        return;
      }
      // A typo changes, adds, drops or swaps a letter or two. A tag that is two or more letters
      // shorter or longer, like `@stable` or `@untestable` next to `@unstable`, is a different word.
      const near = tagStates.find((s) => {
        const expected = s.tag.toLowerCase();
        return (
          Math.abs(lower.length - expected.length) < 2 &&
          editDistance(lower, expected) <= typoThreshold(expected.length - 1)
        );
      });
      if (near) {
        context.report({ node: occurrence.node, messageId: 'tagTypo', data: { found: tag, expected: near.tag } });
      }
    }
  },
});
