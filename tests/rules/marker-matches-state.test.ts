import rule from '../../src/rules/marker-matches-state.js';
import { runRule, settings } from '../helpers.js';

const lifecycle = settings({ lifecycleTags: true });

runRule('marker-matches-state', rule, {
  valid: [
    "// SKIP: WEB-1\ntest.skip('a', async () => {});",
    "test.skip('a', async () => {});",
    "// NOTE: WEB-1\ntest.skip('a', async () => {});",
    // A stray marker on a test with nothing missing is no-orphaned-marker's job.
    "// FIXME: WEB-1\ntest('a', async () => {});",
    { code: "// SKIP: WEB-1\n// NEW: WEB-2\ntest.skip('a @new', async () => {});", settings: lifecycle },
    // A broken marker is require-ticket's job, not a mismatch.
    "// SKIP: TODO\ntest.skip('a', async () => {});",
    // Conditional skips don't need a marker, so nothing is missing.
    "// FIXME: WEB-1\ntest('a', async ({ browserName }) => { test.skip(browserName === 'webkit'); });",
    // A work comment above a skipped test isn't a marker for another state; require-ticket-in-comments
    // and require-ticket report it.
    "// FIXME: solve test intermitencies\ntest.skip('a', async () => {});",
    "// FIXME: flaky\ntest.skip('a', async () => {});",
    // A marker for an inherited state is redundant, not wrong.
    "// SKIP: WEB-1\ntest.describe.skip('s', () => {\n  // SKIP: WEB-1\n  test('a', async () => {});\n});",
  ],
  invalid: [
    {
      code: "// SKIP: WEB-123 flaky\ntest.fixme('a', async () => {});",
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'SKIP', expected: 'FIXME', state: 'fixme', subject: 'this test' },
          suggestions: [
            {
              messageId: 'renameMarker',
              data: { expected: 'FIXME' },
              output: "// FIXME: WEB-123 flaky\ntest.fixme('a', async () => {});",
            },
          ],
        },
      ],
    },
    {
      code: "/*\n * Context first. SKIP: is not a marker here\n * SKIP : WEB-1\n */\ntest.fixme('a', async () => {});",
      errors: [
        {
          messageId: 'wrongMarker',
          suggestions: [
            {
              messageId: 'renameMarker',
              output:
                "/*\n * Context first. FIXME: is not a marker here\n * SKIP : WEB-1\n */\ntest.fixme('a', async () => {});",
            },
          ],
        },
      ],
    },
    {
      code: "test('a', async () => {\n  // FIXME: WEB-1\n  test.skip();\n});",
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'FIXME', expected: 'SKIP', state: 'skip', subject: 'this skip call' },
          suggestions: [
            { messageId: 'renameMarker', output: "test('a', async () => {\n  // SKIP: WEB-1\n  test.skip();\n});" },
          ],
        },
      ],
    },
    {
      code: "// UNSTABLE: WEB-1\ntest.describe.skip('s @new', () => {});",
      settings: lifecycle,
      errors: [
        {
          messageId: 'wrongMarker',
          data: { found: 'UNSTABLE', expected: 'SKIP', state: 'skip', subject: 'this describe block' },
          suggestions: [
            {
              messageId: 'renameMarker',
              data: { expected: 'SKIP' },
              output: "// SKIP: WEB-1\ntest.describe.skip('s @new', () => {});",
            },
            {
              messageId: 'renameMarker',
              data: { expected: 'NEW' },
              output: "// NEW: WEB-1\ntest.describe.skip('s @new', () => {});",
            },
          ],
        },
      ],
    },
    // One marker for a test in two states.
    {
      code: "// SKIP: WEB-1, WEB-2\ntest.skip('a @unstable', async () => {});",
      settings: lifecycle,
      errors: [
        {
          messageId: 'sharedMarker',
          data: { found: 'SKIP', foundState: 'skip', expected: 'UNSTABLE', state: 'unstable', subject: 'This test' },
          suggestions: [
            {
              messageId: 'addMarker',
              data: { expected: 'UNSTABLE', tickets: 'WEB-1, WEB-2' },
              output: "// SKIP: WEB-1, WEB-2\n// UNSTABLE: WEB-1, WEB-2\ntest.skip('a @unstable', async () => {});",
            },
          ],
        },
      ],
    },
    {
      code: "test.describe('s', () => {\n  /* NEW: WEB-1 */\n  test.fixme('a @new', async () => {});\n});",
      settings: lifecycle,
      errors: [
        {
          messageId: 'sharedMarker',
          data: { found: 'NEW', foundState: 'new', expected: 'FIXME', state: 'fixme', subject: 'This test' },
          suggestions: [],
        },
      ],
    },
    {
      code: "// SKIP:\ntest.skip('a @new', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'sharedMarker', suggestions: [] }],
    },
  ],
});
