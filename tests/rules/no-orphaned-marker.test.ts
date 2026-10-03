import rule from '../../src/rules/no-orphaned-marker.js';
import { runRule, settings } from '../helpers.js';

const lifecycle = settings({ lifecycleTags: true });

runRule('no-orphaned-marker', rule, {
  valid: [
    // A test in an arrow function's expression body takes its marker above the call or the statement.
    "['a', 'b'].forEach((name) =>\n  // SKIP: WEB-1\n  test.skip(name, async () => {}),\n);",
    "// SKIP: WEB-1\n['a', 'b'].forEach((name) => test.skip(name, async () => {}));",
    "// SKIP: WEB-1\ntest.skip('a', async () => {});",
    "// Plain comment\ntest('a', async () => {});",
    '// skip: lowercase is not a marker here\nconst x = 1;',
    // With lifecycleTags off, NEW: isn't a known marker.
    "// NEW: WEB-1\ntest('a', async () => {});",
    { code: "// NEW: WEB-1\ntest('a @new', async () => {});", settings: lifecycle },
    // Marker above a conditional skip, or above the test that holds one, is fine.
    "// SKIP: WEB-1\ntest.skip(({ browserName }) => browserName === 'webkit');",
    "// SKIP: WEB-1\ntest('a', async ({ browserName }) => { test.skip(browserName === 'webkit'); });",
    // A test inside a skipped describe may repeat the marker.
    "// SKIP: WEB-1\ntest.describe.skip('s', () => {\n  // SKIP: WEB-1\n  test('a', async () => {});\n});",
    // A mismatch next to a missing marker is marker-matches-state's job.
    "// SKIP: WEB-1\ntest.fixme('a', async () => {});",
    // An ordinary comment that happens to start with a marker keyword is not a leftover ticket.
    "test('a', async ({ page }) => {\n  // FIXME: this check is flaky on slow machines\n  await page.goto('/');\n});",
    // FIXME and TODO are work comments; require-ticket-in-comments checks them, not this rule.
    "test('a', async ({ page }) => {\n  // FIXME: WEB-1\n  await page.goto('/');\n});",
    "// FIXME: later\nconst x = 1;\ntest('a', async () => {});",
    "// TODO: WEB-5\ntest('a', async () => {});",
    "// FIXME:\ntest('a', async () => {});",
    // Files without Playwright tests are not checked at all.
    'const x = 1; // SKIP: WEB-1',
    "import { helper } from './helper';\n// SKIP: WEB-1\nhelper();",
    // A Playwright import alone makes it a test file.
    {
      code: "import { expect } from '@playwright/test';\n// FIXME: WEB-1\nexpect(1).toBe(1);",
    },

    '// FIXME: how to restrict it to frames only\nconst matchers = {};',
    "// SKIP: flaky on CI, see WEB-1\ntest('a', async () => {});",
  ],
  invalid: [
    // A malformed ticket still reads as a marker.
    {
      code: "// SKIP: web-12\ntest('a', async () => {});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this test' },
          suggestions: [{ messageId: 'removeMarker', output: "test('a', async () => {});" }],
        },
      ],
    },
    {
      code: "// NEW: WEB-12 promoted last sprint\ntest('checkout', async () => {});",
      settings: lifecycle,
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'NEW', state: 'new', subject: 'this test' },
          suggestions: [{ messageId: 'removeMarker', output: "test('checkout', async () => {});" }],
        },
      ],
    },
    {
      code: "test.describe('s', () => {\n  // SKIP: WEB-1\n  test.describe('inner', () => {});\n});",
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'SKIP', state: 'skip', subject: 'this describe block' },
          suggestions: [
            {
              messageId: 'removeMarker',
              output: "test.describe('s', () => {\n  test.describe('inner', () => {});\n});",
            },
          ],
        },
      ],
    },
    {
      code: "/* SKIP: WEB-1 */ test('a', async () => {});",
      errors: [
        {
          messageId: 'orphaned',
          suggestions: [{ messageId: 'removeMarker', output: " test('a', async () => {});" }],
        },
      ],
    },
    {
      code: "test('a', async ({ page }) => {\n  // SKIP: WEB-1\n  await page.goto('/');\n});",
      errors: [
        {
          messageId: 'detached',
          data: { marker: 'SKIP' },
          suggestions: [
            { messageId: 'removeMarker', output: "test('a', async ({ page }) => {\n  await page.goto('/');\n});" },
          ],
        },
      ],
    },
    // Custom states are covered too.
    {
      code: "// NEEDS-DATA: WEB-1\ntest('a', async () => {});\nconst y = 2; // NEEDS-DATA: WEB-2",
      settings: settings({ customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } } }),
      errors: [
        {
          messageId: 'orphaned',
          data: { marker: 'NEEDS-DATA', state: 'needs-data', subject: 'this test' },
          suggestions: [
            { messageId: 'removeMarker', output: "test('a', async () => {});\nconst y = 2; // NEEDS-DATA: WEB-2" },
          ],
        },
        {
          messageId: 'detached',
          data: { marker: 'NEEDS-DATA' },
          suggestions: [
            { messageId: 'removeMarker', output: "// NEEDS-DATA: WEB-1\ntest('a', async () => {});\nconst y = 2; " },
          ],
        },
      ],
    },
    {
      code: "test('a', async () => {});\nconst x = 1; // SKIP: WEB-1",
      errors: [
        {
          messageId: 'detached',
          suggestions: [{ messageId: 'removeMarker', output: "test('a', async () => {});\nconst x = 1; " }],
        },
      ],
    },
    {
      code: "// SKIP: WEB-1\n\ntest.skip('a', async () => {});",
      errors: [
        {
          messageId: 'detached',
          suggestions: [{ messageId: 'removeMarker', output: "\ntest.skip('a', async () => {});" }],
        },
      ],
    },
  ],
});
