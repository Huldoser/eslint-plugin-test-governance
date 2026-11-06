import requireTicket from '../../src/rules/require-ticket.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

const reasons = { requireReasonForConditional: true } as const;

const missingReason = (subject: string, argument = '', state = 'skip') => ({
  messageId: 'missingReason' as const,
  data: { subject, state, argument },
});
const call = (example: string) => `, or pass it to the call: \`${example}\``;

runRule('require-ticket (conditional reasons, Playwright)', requireTicket, {
  valid: [
    // The option is off by default.
    'test.skip(isMobile);',
    ...withOptions(reasons, [
      "test.skip(isMobile, 'No hover on touch screens');",
      // A reason known only when the tests run is taken on trust.
      'test.skip(isMobile, reason);',
      'test.skip(isMobile, `${browserName} has no hover`);',
      '// Touch screens have no hover.\ntest.skip(isMobile);',
      '// eslint-disable-next-line no-console -- Touch screens have no hover.\ntest.skip(isMobile);',
      '/*\n * Touch screens have no hover.\n */\ntest.skip(isMobile);',
      "test('hovers', async ({ isMobile }, testInfo) => {\n  testInfo.skip(isMobile, 'No hover');\n});",
      // A comment above the statement around the call, or above its test.
      "test('hovers', async ({ isMobile }) => {\n  // Touch screens have no hover.\n  if (isMobile) {\n    test.skip();\n  }\n});",
      // Or at the end of the line the statement starts on.
      "test('hovers', async ({ isMobile }) => {\n  if (isMobile) { // Touch screens have no hover.\n    test.skip();\n  }\n});",
      "test('hovers', async ({ isMobile }) => {\n  if (isMobile) // Touch screens have no hover.\n    test.skip();\n});",
      "// Touch screens have no hover.\ntest('hovers', async ({ isMobile }) => {\n  test.skip(isMobile);\n});",
      "// Touch screens have no hover.\n(isMobile ? test.skip : test)('hovers', async () => {});",
      // A ticket says why as well, from a marker, a marker on a describe around it, or an annotation.
      '// SKIP: TRADE-1\ntest.skip(isMobile);',
      "// SKIP: TRADE-1\ntest.describe('orders', () => {\n  test('hovers', async ({ isMobile }) => {\n    if (isMobile) test.skip();\n  });\n});",
      "(isMobile ? test.skip : test)('hovers', { annotation: { type: 'issue', description: 'TRADE-1' } }, async () => {});",
      // A comment at the end of the line, or above the hook or step the call is in.
      'test.skip(isMobile); // Touch screens have no hover.',
      '// Touch screens have no hover.\ntest.beforeEach(async ({ isMobile }) => {\n  test.skip(isMobile);\n});',
      "test.describe('orders', () => {\n  // Touch screens have no hover.\n  test.beforeEach(async ({ isMobile }) => {\n    test.skip(isMobile);\n  });\n});",
      "test('hovers', async ({ isMobile }) => {\n  // Touch screens have no hover.\n  await test.step('opens the menu', async () => {\n    test.skip(isMobile);\n  });\n});",
      // Skips that always apply need their ticket, not a reason.
      "// SKIP: TRADE-1\ntest.skip('hovers', async () => {});",
    ]),
    {
      code: '// SKIP: TRADE-1\ntest.skip(isMobile);',
      settings: settings({ ...reasons, requireTicketForConditional: true }),
    },
  ],
  invalid: [
    ...withOptions(reasons, [
      {
        code: 'test.skip(isMobile);',
        errors: [missingReason('This skip call', call("test.skip(condition, 'why')"))],
      },
      {
        code: "test.skip(isMobile, '  ');\ntest.skip(isTablet, undefined);\ntest.skip(isDesktop, 0);",
        errors: [1, 2, 3].map((line) => ({
          ...missingReason('This skip call', call("test.skip(condition, 'why')")),
          line,
        })),
      },
      {
        code: "test('hovers', async ({ isMobile }, testInfo) => {\n  testInfo.fixme(isMobile);\n});",
        errors: [missingReason('This fixme call', call("testInfo.fixme(condition, 'why')"), 'fixme')],
      },
      {
        code: "(isMobile ? test.skip : test)('hovers', async () => {});",
        errors: [missingReason('This test')],
      },
      // The example is written on one line, however the call is.
      {
        code: "test('hovers', async ({ isMobile }) => {\n  test\n    .skip(isMobile);\n});",
        errors: [{ ...missingReason('This skip call', call("test.skip(condition, 'why')")), line: 2 }],
      },
      // A comment with no text, or a directive with no description, gives no reason.
      {
        code: '//\ntest.skip(isMobile);\n// eslint-disable-next-line no-console\ntest.skip(isTablet);',
        errors: [2, 4].map((line) => ({
          ...missingReason('This skip call', call("test.skip(condition, 'why')")),
          line,
        })),
      },
      // Commented-out code and a marker with nothing after it say nothing.
      {
        code: "test('hovers', async ({ isMobile }) => {\n  // test('old hover', async () => {});\n  if (isMobile) {\n    test.skip();\n  }\n});",
        errors: [{ ...missingReason('This skip call', call("test.skip(condition, 'why')")), line: 4 }],
      },
      {
        code: '// SKIP:\ntest.skip(isMobile);',
        errors: [{ ...missingReason('This skip call', call("test.skip(condition, 'why')")), line: 2 }],
      },
      // Only the test around the call counts, not a describe further out or a statement outside its function.
      {
        code: "// Order entry.\ntest.describe('orders', () => {\n  test('hovers', async ({ isMobile }) => {\n    test.skip(isMobile);\n  });\n});",
        errors: [{ ...missingReason('This skip call', call("test.skip(condition, 'why')")), line: 4 }],
      },
      {
        code: "test('hovers', async ({ isMobile }) => {\n  // Helpers.\n  const check = () => {\n    if (isMobile) test.skip();\n  };\n  check();\n});",
        errors: [{ ...missingReason('This skip call', call("test.skip(condition, 'why')")), line: 4 }],
      },
      // The description of an `eslint-disable` region says why the rule is off, not why a test is skipped.
      {
        code: "/* eslint-disable no-console -- the fixtures are untyped JSON */\ntest.describe('orders', () => {\n  test('hovers', async ({ isMobile }) => {\n    test.skip(isMobile);\n  });\n});",
        errors: [{ ...missingReason('This skip call', call("test.skip(condition, 'why')")), line: 4 }],
      },
    ]),
    // With a ticket required as well, the ticket wins.
    {
      code: "test.skip(isMobile, 'No hover');",
      settings: settings({ ...reasons, requireTicketForConditional: true }),
      errors: [
        {
          messageId: 'missingMarker',
          data: { subject: 'This skip call', state: 'skip', marker: 'SKIP', example: 'PROJ-123' },
        },
      ],
    },
  ],
});

runRule('require-ticket (conditional reasons, Vitest)', requireTicket, {
  valid: withOptions({ ...reasons, framework: 'vitest' }, [
    "test('hovers', (context) => {\n  context.skip(isMobile, 'No hover');\n});",
    "test('hovers', (context) => {\n  if (isMobile) context.skip('No hover');\n});",
    "// Touch screens have no hover.\ntest.skipIf(isMobile)('hovers', () => {});",
    "// Touch screens have no hover.\ntest('hovers', { skip: isMobile }, () => {});",
    "test.skipIf(isMobile)('hovers', () => {}); // Touch screens have no hover.",
    // A template is text, so it is a reason, not a condition.
    "test('hovers', (context) => {\n  if (isMobile) context.skip(`${device} has no hover`);\n});",
  ]),
  invalid: withOptions({ ...reasons, framework: 'vitest' }, [
    {
      code: "test('hovers', (context) => {\n  if (isMobile) context.skip();\n});",
      errors: [missingReason('This skip call', call("context.skip('why')"))],
    },
    {
      code: "test('hovers', (context) => {\n  if (isMobile) context.skip('');\n});",
      errors: [missingReason('This skip call', call("context.skip('why')"))],
    },
    {
      code: "test('hovers', (context) => {\n  context.skip(isMobile);\n});",
      errors: [missingReason('This skip call', call("context.skip(condition, 'why')"))],
    },
    { code: "test.skipIf(isMobile)('hovers', () => {});", errors: [missingReason('This test')] },
    {
      code: "/* eslint-disable no-console -- debug output */\ntest.skipIf(isMobile)('hovers', () => {});",
      errors: [{ ...missingReason('This test'), line: 2 }],
    },
    // Vitest's `skip` option is a flag, so text in it is no reason it reports.
    { code: "test('hovers', { skip: isMobile && 'No hover' }, () => {});", errors: [missingReason('This test')] },
  ]),
});

runRule('require-ticket (conditional reasons, node:test)', requireTicket, {
  valid: withOptions({ ...reasons, framework: 'node-test' }, [
    "test('follows links', { skip: isWindows && 'No symlinks' }, () => {});",
    "test('follows links', { skip: isWindows ? 'No symlinks' : false }, () => {});",
    "test('follows links', { skip: isLinux ? false : 'No symlinks' }, () => {});",
    "test('follows links', { todo: isWindows && 'Symlinks next' }, () => {});",
    "test('follows links', { skip: isWindows && `No symlinks on ${platform}` }, () => {});",
    "test('follows links', { skip: isWindows ? `No symlinks on ${platform}` : false }, () => {});",
    "test('follows links', (t) => {\n  if (isWindows) t.skip('No symlinks');\n});",
    // node:test's `t.skip()` takes only a reason, so a name or a template is one.
    "test('follows links', (t) => {\n  if (isWindows) t.skip(reason);\n});",
    "test('follows links', (t) => {\n  if (isWindows) t.skip(`${platform} has no symlinks`);\n});",
  ]),
  invalid: withOptions({ ...reasons, framework: 'node-test' }, [
    { code: "test('follows links', { skip: isWindows }, () => {});", errors: [missingReason('This test')] },
    // Only text Node reports counts: not the other side of `||`, and not a name.
    {
      code: "test('follows links', { skip: isWindows || 'No symlinks' }, () => {});",
      errors: [missingReason('This test')],
    },
    { code: "test('follows links', { skip: isWindows && reason }, () => {});", errors: [missingReason('This test')] },
    {
      code: "test('follows links', (t) => {\n  if (isWindows) t.skip();\n});",
      errors: [missingReason('This skip call', call("t.skip('why')"))],
    },
  ]),
});

runRule('require-ticket (conditional reasons, other runners)', requireTicket, {
  valid: [
    {
      code: "it('places an order', () => {\n  if (marketClosed) pending('The market is closed');\n});",
      settings: settings({ ...reasons, framework: 'jasmine' }),
    },
    {
      code: "it('places an order', () => {\n  if (marketClosed) pending(reason);\n});",
      settings: settings({ ...reasons, framework: 'jasmine' }),
    },
    {
      code: "describe('orders', function () {\n  // The sandbox has no market data on weekends.\n  before(function () {\n    if (isWeekend) this.skip();\n  });\n});",
      settings: settings({ ...reasons, framework: 'mocha' }),
    },
    {
      code: "it('places an order', function () {\n  // The sandbox has no market data on weekends.\n  if (isWeekend) this.skip();\n});",
      settings: settings({ ...reasons, framework: 'mocha' }),
    },
  ],
  invalid: [
    {
      code: "it('places an order', () => {\n  if (marketClosed) pending('');\n});",
      settings: settings({ ...reasons, framework: 'jasmine' }),
      errors: [missingReason('This pending call', call("pending('why')"))],
    },
    {
      code: "it('places an order', () => {\n  if (marketClosed) pending();\n});",
      settings: settings({ ...reasons, framework: 'jasmine' }),
      errors: [missingReason('This pending call', call("pending('why')"))],
    },
    // Mocha's `this.skip()` takes no reason, so the comment is the only place for it.
    {
      code: "it('places an order', function () {\n  if (isWeekend) this.skip();\n});",
      settings: settings({ ...reasons, framework: 'mocha' }),
      errors: [missingReason('This skip call')],
    },
    {
      code: "(isCI ? it.skip : it)('places an order', () => {});",
      settings: settings({ ...reasons, framework: 'jest' }),
      errors: [missingReason('This test')],
    },
  ],
});
