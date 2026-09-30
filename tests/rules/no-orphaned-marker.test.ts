import rule from '../../src/rules/no-orphaned-marker.js';
import { runRule, settings } from '../helpers.js';

const lifecycle = settings({ lifecycleTags: true });

runRule('no-orphaned-marker', rule, {
  valid: [
    "// SKIP: WEB-1\ntest.skip('a', async () => {});",
    "// Plain comment\ntest('a', async () => {});",
    "// skip: lowercase is not a marker here\nconst x = 1;",
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
  ],
  invalid: [
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
          suggestions: [{ messageId: 'removeMarker', output: "test.describe('s', () => {\n  test.describe('inner', () => {});\n});" }],
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
      code: "test('a', async ({ page }) => {\n  // FIXME: WEB-1\n  await page.goto('/');\n});",
      errors: [
        {
          messageId: 'detached',
          data: { marker: 'FIXME' },
          suggestions: [{ messageId: 'removeMarker', output: "test('a', async ({ page }) => {\n  await page.goto('/');\n});" }],
        },
      ],
    },
    {
      code: "const x = 1; // SKIP: WEB-1",
      errors: [{ messageId: 'detached', suggestions: [{ messageId: 'removeMarker', output: 'const x = 1; ' }] }],
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
