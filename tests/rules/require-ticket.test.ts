import rule from '../../src/rules/require-ticket.js';
import { runRule, settings } from '../helpers.js';

const ANY = 'a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL';
const lifecycle = settings({ lifecycleTags: true });

const missing = (state: string, marker: string, subject = 'This test', example = 'PROJ-123') => ({
  messageId: 'missingMarker' as const,
  data: { subject, state, marker, example },
});

runRule('require-ticket', rule, {
  valid: [
    "test('plain', async () => {});",
    "test.describe('suite', () => { test('a', async () => {}); });",
    // SKIP: marker with free text after the ticket
    "// SKIP: WEB-123 flaky on CI\ntest.skip('a', async () => {});",
    "/* SKIP: WEB-123 */\ntest.skip('a', async () => {});",
    "/**\n * Waiting on the new checkout API.\n * SKIP: WEB-123\n */\ntest.skip('a', async () => {});",
    "// SKIP: WEB-1\n// eslint-disable-next-line no-empty-function\ntest.skip('a', async () => {});",
    "// SKIP: WEB-1, WEB-2 both needed\ntest.skip('a', async () => {});",
    "// SKIP: WEB-1: flaky\ntest.skip('a', async () => {});",
    "// SKIP: https://jira.example.com/browse/WEB-1\ntest.skip('a', async () => {});",
    "// SKIP: #4821\ntest.skip('a', async () => {});",
    "// SKIP: acme/web#4821\ntest.skip('a', async () => {});",
    "// FIXME: WEB-9\ntest.fixme('a', async () => {});",
    "// FIXME: WEB-9\ntest.fixme('a', { tag: '@smoke' }, async () => {});",
    "/* SKIP: WEB-1 */ test.skip('a', async () => {});",
    // A marker on a skipped describe covers its tests, even ones skipped again.
    "// SKIP: WEB-1\ntest.describe.skip('suite', () => {\n  test('a', async () => {});\n  test.skip('b', async () => {});\n});",
    "// FIXME: WEB-1\ntest.describe.fixme(() => { test('a', async () => {}); });",
    // Conditional skips are platform limits and need no ticket by default.
    "test('a', async ({ browserName }) => { test.skip(browserName === 'webkit', 'Not supported'); });",
    "test.describe('s', () => { test.skip(({ browserName }) => browserName === 'webkit', 'n/a'); });",
    "test('a', async ({ page }, testInfo) => { testInfo.skip(process.env.CI === undefined); });",
    // Runtime skips: marker above the call or above the enclosing test.
    "test('a', async () => {\n  // SKIP: WEB-1\n  test.skip();\n});",
    "// SKIP: WEB-1\ntest('a', async () => {\n  test.skip();\n});",
    "// SKIP: WEB-1\ntest.describe('s', () => {\n  test('a', async () => {\n    test.skip();\n  });\n});",
    "// SKIP: WEB-1\ntest('a', async ({ page }, testInfo) => {\n  testInfo.skip();\n});",
    "test('a', async () => {\n  // FIXME: WEB-1\n  await test.info().fixme();\n});",
    "test('a', async () => {\n  // FIXME: WEB-1\n  const run = () => test.fixme();\n});",
    // Tags are off unless lifecycleTags is set.
    "test('checkout @new', async () => {});",
    "test('checkout', { tag: '@unstable' }, async () => {});",
    { code: "// NEW: WEB-1\ntest('checkout @new', async () => {});", settings: lifecycle },
    { code: "// NEW: WEB-1\ntest('checkout', { tag: ['@new', '@smoke'] }, async () => {});", settings: lifecycle },
    { code: "// NEW: WEB-1\ntest('checkout', { 'tag': `@new` }, async () => {});", settings: lifecycle },
    { code: "// NEW: WEB-1\ntest(`checkout ${'x'} @new`, async () => {});", settings: lifecycle },
    { code: "test('mail user@new.com', async () => {});", settings: lifecycle },
    { code: "test('checkout @newer', async () => {});", settings: lifecycle },
    { code: "test('checkout', { tag: [someTag, ...more] }, async () => {});", settings: lifecycle },
    { code: "test('checkout', { [key]: '@new', ...rest }, async () => {});", settings: lifecycle },
    { code: "// NEW: WEB-1\ntest('checkout', { annotation: { type: 'x' }, tag: '@new' }, async () => {});", settings: lifecycle },
    "const list = [, 1];\ntest('a', async () => { const [, b] = list; });",
    { code: "test(title, async () => {});", settings: lifecycle },
    {
      code: "// UNSTABLE: WEB-1\ntest.describe('flows @unstable', () => {\n  test('a @unstable', async () => {});\n  test('b', async () => {});\n});",
      settings: lifecycle,
    },
    // Tickets are never read from titles, even when they look like one.
    "test('SDQA-52: Successful logout', async () => {});",
    // fail and slow are off by default.
    "test.fail('a', async () => {});",
    "test('a', async () => { test.slow(); });",
    // Only Playwright's test function counts.
    "foo.skip('a', async () => {});",
    "describe.skip('a', () => {});",
    "it.skip('a', async () => {});",
    "test[method]('a', async () => {});",
    "obj.test.skip('a', async () => {});",
    "test.describe.configure({ mode: 'serial' });",
    "test.step('a', async () => { other.skip(); });",
    "test.skip.each('a', async () => {});",
    "fn()();",
    "test.info().annotations.push({ type: 'x' });",
    "helper().skip();",
    "test('a', async (fixtures, info) => { other.skip(); });",
    { code: "// SKIP: WEB-1\n\ntest.skip('a', async () => {});", settings: settings({ allowBlankLine: true }) },
    {
      code: "import { test as it } from '@playwright/test';\n// SKIP: WEB-1\nit.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
    },
    {
      code: "// SKIP: #4821\ntest.skip('a', async () => {});",
      settings: settings({ ticket: { preset: 'github' } }),
    },
    {
      code: "// FIXME: #4821\ntest.fixme('a', async () => {});\n// SKIP: WEB-1\ntest.skip('b', async () => {});",
      settings: settings({ states: { fixme: { ticket: { preset: 'github' } } } }),
    },
    {
      code: "// QUARANTINE: WEB-1\ntest.skip('a', async () => {});",
      settings: settings({ states: { skip: { marker: 'QUARANTINE' } } }),
    },
    { code: "test.skip('a', async () => {});", settings: settings({ states: { skip: false } }) },
    {
      code: "// NEEDS-DATA: WEB-1\ntest('a @needs-data', async () => {});",
      settings: settings({ customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } } }),
    },
    {
      code: "// SKIP: 4821\ntest.skip('a', async () => {});",
      settings: settings({ ticket: { preset: 'numeric' }, placeholders: [] }),
    },
    { code: "test('a', async () => { test.skip(); });", options: [{ states: { skip: false } }] },
    { code: 'test(title, async () => {});', settings: settings({ reportDynamicTitles: true }) },
  ],
  invalid: [
    { code: "test.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "test.fixme('a', async () => {});", errors: [missing('fixme', 'FIXME')] },
    {
      code: "test.describe.skip('s', () => { test('a', async () => {}); });",
      errors: [missing('skip', 'SKIP', 'This describe block')],
    },
    {
      code: "test.describe.serial.fixme('s', () => {});",
      errors: [missing('fixme', 'FIXME', 'This describe block')],
    },
    // A marker above a plain describe does not cover a test skipped inside it.
    {
      code: "// SKIP: WEB-1\ntest.describe('s', () => {\n  test.skip('a', async () => {});\n});",
      errors: [missing('skip', 'SKIP')],
    },
    // The test-case ID in the title is not a ticket.
    { code: "test.skip('SDQA-52: Successful logout', async () => {});", errors: [missing('skip', 'SKIP')] },
    { code: "// SKIP:\ntest.skip('a', async () => {});", errors: [{ messageId: 'missingTicket' }] },
    { code: '/* SKIP: */\ntest.skip(\'a\', async () => {});', errors: [{ messageId: 'missingTicket' }] },
    { code: "// SKIP: , WEB-1\ntest.skip('a', async () => {});", errors: [{ messageId: 'missingTicket' }] },
    {
      code: "// SKIP: flaky on CI\ntest.skip('a', async () => {});",
      errors: [{ messageId: 'invalidTicket', data: { ticket: 'flaky', state: 'skip', expected: ANY } }],
    },
    {
      code: "// SKIP: WEB-1, nope\ntest.skip('a', async () => {});",
      errors: [{ messageId: 'invalidTicket', data: { ticket: 'nope', state: 'skip', expected: ANY } }],
    },
    ...['TODO', 'tbd', 'XXX-1', '#123', '0', '12345'].map((ticket) => ({
      code: `// SKIP: ${ticket}\ntest.skip('a', async () => {});`,
      errors: [{ messageId: 'placeholderTicket' as const, data: { ticket } }],
    })),
    {
      code: "// skip: WEB-1\ntest.skip('a', async () => {});",
      errors: [{ messageId: 'markerCase', data: { marker: 'SKIP', found: 'skip' }, line: 1 }],
    },
    {
      code: "// Fixme: WEB-1\ntest.fixme('a', async () => {});",
      errors: [{ messageId: 'markerCase', data: { marker: 'FIXME', found: 'Fixme' } }],
    },
    // A blank line breaks the block.
    { code: "// SKIP: WEB-1\n\ntest.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    // A trailing comment on the previous line belongs to that line.
    { code: "setup(); // SKIP: WEB-1\ntest.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    // A marker for another state doesn't count.
    { code: "// FIXME: WEB-1\ntest.skip('a', async () => {});", errors: [missing('skip', 'SKIP')] },
    // Unconditional runtime skips.
    { code: "test('a', async () => {\n  test.skip();\n});", errors: [missing('skip', 'SKIP', 'This skip call')] },
    { code: "test('a', async () => { test.skip(true, 'broken'); });", errors: [missing('skip', 'SKIP', 'This skip call')] },
    { code: 'test.skip();', errors: [missing('skip', 'SKIP', 'This skip call')] },
    {
      code: "test('a', async ({ page }, testInfo) => { testInfo.fixme(); });",
      errors: [missing('fixme', 'FIXME', 'This fixme call')],
    },
    {
      code: "test.beforeEach(async ({ page }, info) => { info.skip(); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('a', async () => { test.info().skip(); });",
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    {
      code: "test('a', async ({ browserName }) => { test.skip(browserName === 'webkit', 'n/a'); });",
      settings: settings({ requireTicketForConditional: true }),
      errors: [missing('skip', 'SKIP', 'This skip call')],
    },
    // Tags, once lifecycleTags is on.
    { code: "test('checkout @new', async () => {});", settings: lifecycle, errors: [missing('new', 'NEW')] },
    {
      code: "test('checkout', { tag: '@unstable' }, async () => {});",
      settings: lifecycle,
      errors: [missing('unstable', 'UNSTABLE')],
    },
    {
      code: "test('checkout', { tag: ['@smoke', '@new'] }, async () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    {
      code: "test(`checkout ${step} @new`, async () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    {
      code: "test.describe('flows @unstable', () => { test('a', async () => {}); });",
      settings: lifecycle,
      errors: [missing('unstable', 'UNSTABLE', 'This describe block')],
    },
    // Both states need a marker.
    {
      code: "// SKIP: WEB-1\ntest.skip('a', { tag: '@new' }, async () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    // A broken marker on a describe is reported once, not once per test.
    {
      code: "// UNSTABLE: TODO\ntest.describe('s @unstable', () => {\n  test('a @unstable', async () => {});\n  test('b @unstable', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'placeholderTicket', data: { ticket: 'TODO' } }],
    },
    {
      code: "import { test as it } from '@playwright/test';\nit.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import { 'test' as named } from '@playwright/test';\nnamed.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import pwTest from '@playwright/test';\npwTest.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "import { test as base, expect } from '@playwright/test';\nimport other from 'other';\nexport const myTest = base.extend({}).extend({});\nconst made = make(), deep = obj.a.extend({});\nconst x = 1, y = other.extend({});\nlet z;\nexport {};\nmyTest.skip('a', async () => {});\ny.skip('b', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "const { test: pwTest, expect } = require('@playwright/test');\nconst { other } = require('other');\nconst { ...rest } = require('@playwright/test');\nconst { test: { nested } } = require('@playwright/test');\npwTest.skip('a', async () => {});",
      settings: settings({ testFunctions: [] }),
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "test['skip']('a', async () => {});",
      errors: [missing('skip', 'SKIP')],
    },
    {
      code: "// SKIP: OPS-1\ntest.skip('a', async () => {});",
      settings: settings({ ticket: { preset: 'jira', projects: ['WEB'] } }),
      errors: [
        {
          messageId: 'invalidTicket',
          data: { ticket: 'OPS-1', state: 'skip', expected: 'a Jira key like WEB-123 in project WEB, or a Jira URL' },
        },
      ],
    },
    {
      code: "// FIXME: WEB-1\ntest.fixme('a', async () => {});",
      settings: settings({ states: { fixme: { ticket: { preset: 'github' } } } }),
      errors: [
        {
          messageId: 'invalidTicket',
          data: { ticket: 'WEB-1', state: 'fixme', expected: 'a GitHub issue like #4821 or owner/repo#4821, or an issue URL on github.com' },
        },
      ],
    },
    {
      code: "test('a @needs-data', async () => {});",
      settings: settings({ customStates: { 'needs-data': { when: '@needs-data', marker: 'NEEDS-DATA' } } }),
      errors: [missing('needs-data', 'NEEDS-DATA')],
    },
    {
      code: "test.fail('a', async () => {});\ntest('b', async () => { test.slow(); });",
      settings: settings({ states: { fail: true, slow: { enabled: true } } }),
      errors: [missing('fail', 'FAIL'), missing('slow', 'SLOW', 'This slow call')],
    },
    {
      code: "test.skip('a', async () => {});",
      options: [{ ticket: { preset: 'linear', teams: ['ENG'] } }],
      errors: [missing('skip', 'SKIP', 'This test', 'ENG-123')],
    },
    {
      code: 'test(title, async () => {});\ntest.describe(name, () => {});',
      settings: settings({ lifecycleTags: true, reportDynamicTitles: true }),
      errors: [{ messageId: 'dynamicTitle', column: 6 }, { messageId: 'dynamicTitle', column: 15 }],
    },
  ],
});
