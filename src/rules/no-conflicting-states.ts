import type { TagOccurrence } from '../utils/analyze.js';
import { createRule } from '../utils/create-rule.js';
import { editDistance, typoThreshold } from '../utils/distance.js';
import { tagRange } from '../utils/fix.js';

export default createRule({
  name: 'no-conflicting-states',
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Disallow state tags that contradict each other, differ in case or look like typos',
      recommended: 'warn',
    },
    messages: {
      newAndUnstable: '`{{new}}` and `{{unstable}}` are separate stages; a test should be in only one of them.',
      newSkipped: "`{{new}}` on a skipped test: a new test that doesn't run can't be promoted. Fix the test or drop the tag.",
      tagCase: '`{{found}}` should be written `{{expected}}`.',
      tagTypo: '`{{found}}` looks like a typo of `{{expected}}`.',
    },
  },
  check(context, analysis, options) {
    const { sourceCode } = context;
    const tagStates = options.states.filter((s) => s.tag !== undefined);
    const newTag = options.states.find((s) => s.name === 'new')?.tag;
    const unstableTag = options.states.find((s) => s.name === 'unstable')?.tag;

    for (const subject of analysis.subjects) {
      const ownIndex = new Map<string, number>();
      for (const occurrence of subject.tags) {
        const index = ownIndex.get(occurrence.tag + '\0' + occurrence.node.range[0]) ?? 0;
        ownIndex.set(occurrence.tag + '\0' + occurrence.node.range[0], index + 1);
        checkSpelling(occurrence, index);
      }

      if (newTag === undefined) continue;
      const own = (tag: string): TagOccurrence | undefined => subject.tags.find((t) => t.tag === tag);
      const has = (tag: string): boolean => own(tag) !== undefined || subject.inheritedTags.has(tag);
      const ownNew = own(newTag);

      if (unstableTag !== undefined && has(newTag) && has(unstableTag)) {
        const ownUnstable = own(unstableTag);
        if (ownNew || ownUnstable) {
          context.report({
            node: (ownNew ?? ownUnstable)!.node,
            messageId: 'newAndUnstable',
            data: { new: newTag, unstable: unstableTag },
          });
        }
      }
      if (has(newTag) && subject.skipped && (ownNew || subject.parent?.skipped !== true)) {
        context.report({ node: ownNew?.node ?? subject.node, messageId: 'newSkipped', data: { new: newTag } });
      }
    }

    function checkSpelling(occurrence: TagOccurrence, index: number): void {
      const { tag } = occurrence;
      if (tagStates.some((s) => s.tag === tag)) return;
      const lower = tag.toLowerCase();
      const sameLetters = tagStates.find((s) => s.tag!.toLowerCase() === lower);
      if (sameLetters) {
        const range = tagRange(sourceCode, occurrence.node, tag, index);
        context.report({
          node: occurrence.node,
          messageId: 'tagCase',
          data: { found: tag, expected: sameLetters.tag },
          fix: range && ((fixer) => fixer.replaceTextRange(range, sameLetters.tag!)),
        });
        return;
      }
      const near = tagStates.find((s) => {
        const expected = s.tag!.toLowerCase();
        return editDistance(lower, expected) <= typoThreshold(expected.length - 1);
      });
      if (near) {
        context.report({ node: occurrence.node, messageId: 'tagTypo', data: { found: tag, expected: near.tag } });
      }
    }
  },
});
