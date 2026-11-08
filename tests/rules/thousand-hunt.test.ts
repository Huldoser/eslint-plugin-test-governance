import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from '../../src/rules/require-ticket.ts';
import commented from '../../src/rules/require-ticket-for-commented-out-tests.ts';
import { runRule, settings } from '../helpers.ts';

runRule('require-ticket (mutation and primitive controls)', rule, {
  valid: [
    {
      code: "const T = { tag: '@new' }; Object[method](T); Object.keys(T);\n// NEW: PROBE-17\ntest('control', { tag: T.tag }, () => {});",
      settings: settings({ lifecycleTags: true, reportUnreadableTags: true }),
    },
    {
      code: "const T = { tag: '@new' }; const Object = helper; Object.assign(T, {});\n// NEW: PROBE-17\ntest('control', { tag: T.tag }, () => {});",
      settings: settings({ lifecycleTags: true, reportUnreadableTags: true }),
    },
    {
      code: 'test(`${-1n}@new`, () => {});',
      settings: settings({ lifecycleTags: true }),
    },
  ],
  invalid: [
    {
      code: "const R = { count: R }; test('control', { retry: R }, () => {});",
      settings: settings({ framework: 'vitest', states: { retry: true } }),
      errors: [{ messageId: 'missingMarker' }],
    },
    {
      code: "function f(NaN) { test.skip('control', { meta: { issue: `PROBE-${NaN}` } }, () => {}); }",
      settings: settings({ framework: 'vitest', annotations: { only: true }, reportUnreadableTags: true }),
      errors: [{ messageId: 'missingAnnotation' }, { messageId: 'unreadAnnotation' }],
    },
    {
      code: "test.skip('control', { meta: { issue: `PROBE-${-external}` } }, () => {}); test.skip('control', { meta: { issue: `PROBE-${-\"text\"}` } }, () => {});",
      settings: settings({ framework: 'vitest', annotations: { only: true }, reportUnreadableTags: true }),
      errors: [
        { messageId: 'missingAnnotation' },
        { messageId: 'unreadAnnotation' },
        { messageId: 'missingAnnotation' },
        { messageId: 'unreadAnnotation' },
      ],
    },
  ],
});

runRule('require-ticket (1000-case hunt boundaries)', rule, {
  valid: [
    {
      code: "test.skip.skipIf(false)('matrix', () => {});",
      name: 'test.skip.skipIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skip.runIf(true)('matrix', () => {});",
      name: 'test.skip.runIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(true).skipIf(false)('matrix', () => {});",
      name: 'test.skipIf(true).skipIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(true).runIf(true)('matrix', () => {});",
      name: 'test.skipIf(true).runIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(false).skipIf(false)('matrix', () => {});",
      name: 'test.skipIf(false).skipIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(false).runIf(true)('matrix', () => {});",
      name: 'test.skipIf(false).runIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(true).skipIf(false)('matrix', () => {});",
      name: 'test.runIf(true).skipIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(true).runIf(true)('matrix', () => {});",
      name: 'test.runIf(true).runIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(false).skipIf(false)('matrix', () => {});",
      name: 'test.runIf(false).skipIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(false).runIf(true)('matrix', () => {});",
      name: 'test.runIf(false).runIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: " test('matrix', { retry: { ...{ count: 2 }, count: 0 } }, () => {});",
      name: 'vitest retry object 0, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retry: { count: 2, ...{ count: 0 } } }, () => {});",
      name: 'vitest retry object 1, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retry: { count: 2, count: 0 } }, () => {});",
      name: 'vitest retry object 3, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retry: { [dynamic]: 2, count: 0 } }, () => {});",
      name: 'vitest retry object 6, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retry: { ...external, count: 0 } }, () => {});",
      name: 'vitest retry object 7, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retry: { count: 0 } }, () => {});",
      name: 'vitest retry object 8, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: "const R = { count: 0 };  test('matrix', { retry: R }, () => {});",
      name: 'vitest retry object 8, carrier 1',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: "const R = { count: 0 }; const S = R; test('matrix', { retry: S }, () => {});",
      name: 'vitest retry object 8, carrier 2',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: "const H = { value: { count: 0 } }; test('matrix', { retry: H.value }, () => {});",
      name: 'vitest retry object 8, carrier 4',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { ...{ runMode: 2 }, runMode: 0, openMode: 0 } }, () => {});",
      name: 'cypress retry object 0, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { runMode: 2, ...{ runMode: 0 }, openMode: 0 } }, () => {});",
      name: 'cypress retry object 1, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { runMode: 2, runMode: 0, openMode: 0 } }, () => {});",
      name: 'cypress retry object 3, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { [dynamic]: 2, runMode: 0, openMode: 0 } }, () => {});",
      name: 'cypress retry object 6, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { ...external, runMode: 0, openMode: 0 } }, () => {});",
      name: 'cypress retry object 7, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { runMode: 0, openMode: 0 } }, () => {});",
      name: 'cypress retry object 8, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: "const R = { runMode: 0, openMode: 0 };  test('matrix', { retries: R }, () => {});",
      name: 'cypress retry object 8, carrier 1',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: "const R = { runMode: 0, openMode: 0 }; const S = R; test('matrix', { retries: S }, () => {});",
      name: 'cypress retry object 8, carrier 2',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: "const H = { value: { runMode: 0, openMode: 0 } }; test('matrix', { retries: H.value }, () => {});",
      name: 'cypress retry object 8, carrier 4',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: 'test(`${-1}@new`, () => {});',
      name: 'Primitive 0, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      code: 'test(`${1n}@new`, () => {});',
      name: 'Primitive 1, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      code: 'test(`${-0}@new`, () => {});',
      name: 'Primitive 2, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      code: 'test(`${false}@new`, () => {});',
      name: 'Primitive 3, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      code: 'test(`${1e21}@new`, () => {});',
      name: 'Primitive 4, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      code: "test(`${'box'}@new`, () => {});",
      name: 'Primitive 5, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      code: 'test(`${undefined}@new`, () => {});',
      name: 'Primitive 6, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      code: 'test(`${void 0}@new`, () => {});',
      name: 'Primitive 7, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      code: 'test(`${NaN}@new`, () => {});',
      name: 'Primitive 8, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
    {
      code: 'test(`${Infinity}@new`, () => {});',
      name: 'Primitive 9, boundary 0, title',
      settings: settings({ framework: 'playwright', lifecycleTags: true }),
    },
  ],
  invalid: [
    {
      code: "test.skip.skip('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.skip.skip; conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skip.skipIf(true)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.skip.skipIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skip.runIf(false)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.skip.runIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(true).skip('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.skipIf(true).skip; conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(true).skipIf(true)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.skipIf(true).skipIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(true).runIf(false)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.skipIf(true).runIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(false).skip('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.skipIf(false).skip; conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(false).skipIf(true)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.skipIf(false).skipIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.skipIf(false).runIf(false)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.skipIf(false).runIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(true).skip('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.runIf(true).skip; conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(true).skipIf(true)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.runIf(true).skipIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(true).runIf(false)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.runIf(true).runIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(false).skip('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.runIf(false).skip; conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(false).skipIf(true)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.runIf(false).skipIf(true); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: "test.runIf(false).runIf(false)('matrix', () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'test.runIf(false).runIf(false); conditional tickets false',
      settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
    },
    {
      code: " test('matrix', { retry: { count: 0, ...{ count: 2 } } }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'vitest retry object 2, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retry: { count: 0, count: 2 } }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'vitest retry object 4, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retry: { count: 0, ...external } }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'vitest retry object 5, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retry: { count: count } }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'vitest retry object 9, carrier 0',
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { runMode: 0, ...{ runMode: 2 }, openMode: 0 } }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'cypress retry object 2, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { runMode: 0, runMode: 2, openMode: 0 } }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'cypress retry object 4, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { runMode: 0, ...external, openMode: 0 } }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'cypress retry object 5, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
    {
      code: " test('matrix', { retries: { runMode: count, openMode: 0 } }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
      name: 'cypress retry object 9, carrier 0',
      settings: settings({ framework: 'cypress', states: { retry: true } }),
    },
  ],
});
runRule('require-ticket-for-commented-out-tests (1000-case hunt boundaries)', commented, {
  valid: [
    {
      code: "import { test } from '@playwright/test';\n/**\n * SKIP: PROBE-17\n * SKIP: TBD\n * test('matrix', () => {});\n */",
      name: 'Commented markers 0, style 2, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP: PROBE-18\n// test('matrix', () => {});",
      name: 'Commented markers 6, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP: PROBE-18\n// test('matrix', () => {});",
      name: 'Commented markers 6, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17 note\n// SKIP: PROBE-18\n// test('matrix', () => {});",
      name: 'Commented markers 8, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP: PROBE-18 note\n// test('matrix', () => {});",
      name: 'Commented markers 9, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
  ],
  invalid: [
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP: TBD\n// test('matrix', () => {});",
      errors: [{ messageId: 'placeholderTicket' }],
      name: 'Commented markers 0, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP: TBD\n// test('matrix', () => {});",
      errors: [{ messageId: 'placeholderTicket' }],
      name: 'Commented markers 0, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n/*\nSKIP: PROBE-17\nSKIP: TBD\ntest('matrix', () => {});\n*/",
      errors: [{ messageId: 'placeholderTicket' }],
      name: 'Commented markers 0, style 1, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\r\n// SKIP: TBD\r\n// test('matrix', () => {});",
      errors: [{ messageId: 'placeholderTicket' }],
      name: 'Commented markers 0, style 3, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\r// SKIP: TBD\r// test('matrix', () => {});",
      errors: [{ messageId: 'placeholderTicket' }],
      name: 'Commented markers 0, style 4, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP:\n// test('matrix', () => {});",
      errors: [{ messageId: 'missingTicket' }],
      name: 'Commented markers 1, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP:\n// test('matrix', () => {});",
      errors: [{ messageId: 'missingTicket' }],
      name: 'Commented markers 1, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP: invalid\n// test('matrix', () => {});",
      errors: [{ messageId: 'invalidTicket' }],
      name: 'Commented markers 2, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP: invalid\n// test('matrix', () => {});",
      errors: [{ messageId: 'invalidTicket' }],
      name: 'Commented markers 2, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: TBD\n// SKIP: PROBE-17\n// test('matrix', () => {});",
      errors: [{ messageId: 'placeholderTicket' }],
      name: 'Commented markers 3, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: TBD\n// SKIP: PROBE-17\n// test('matrix', () => {});",
      errors: [{ messageId: 'placeholderTicket' }],
      name: 'Commented markers 3, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP:\n// SKIP: PROBE-17\n// test('matrix', () => {});",
      errors: [{ messageId: 'missingTicket' }],
      name: 'Commented markers 4, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP:\n// SKIP: PROBE-17\n// test('matrix', () => {});",
      errors: [{ messageId: 'missingTicket' }],
      name: 'Commented markers 4, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: invalid\n// SKIP: PROBE-17\n// test('matrix', () => {});",
      errors: [{ messageId: 'invalidTicket' }],
      name: 'Commented markers 5, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: invalid\n// SKIP: PROBE-17\n// test('matrix', () => {});",
      errors: [{ messageId: 'invalidTicket' }],
      name: 'Commented markers 5, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17 note\n// SKIP: TBD\n// test('matrix', () => {});",
      errors: [{ messageId: 'placeholderTicket' }],
      name: 'Commented markers 7, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17 note\n// SKIP: TBD\n// test('matrix', () => {});",
      errors: [{ messageId: 'placeholderTicket' }],
      name: 'Commented markers 7, style 0, notes true',
      settings: settings({ framework: 'playwright', allowNotes: true }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17 note\n// SKIP: PROBE-18\n// test('matrix', () => {});",
      errors: [{ messageId: 'extraText', suggestions: 1 }],
      name: 'Commented markers 8, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
    {
      code: "import { test } from '@playwright/test';\n// SKIP: PROBE-17\n// SKIP: PROBE-18 note\n// test('matrix', () => {});",
      errors: [{ messageId: 'extraText', suggestions: 1 }],
      name: 'Commented markers 9, style 0, notes false',
      settings: settings({ framework: 'playwright', allowNotes: false }),
    },
  ],
});
new RuleTester({ languageOptions: { parser: tsParser } }).run(
  'require-ticket (1000-case hunt TypeScript boundaries)',
  rule as never,
  {
    valid: [
      {
        code: " test('matrix', { retry: ({ count: 0 } as const) }, () => {});",
        name: 'vitest retry object 8, carrier 3',
        settings: settings({ framework: 'vitest', states: { retry: true } }),
      },
      {
        code: " test('matrix', { retries: ({ runMode: 0, openMode: 0 } as const) }, () => {});",
        name: 'cypress retry object 8, carrier 3',
        settings: settings({ framework: 'cypress', states: { retry: true } }),
      },
    ],
    invalid: [
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (t as any).skip(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 74 }],
        name: 'node-skip wrapper 0; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { t!.skip(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 66 }],
        name: 'node-skip wrapper 1; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (t.skip as any)(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 74 }],
        name: 'node-skip wrapper 2; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (t.skip!)(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 68 }],
        name: 'node-skip wrapper 3; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (<any>t).skip(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 72 }],
        name: 'node-skip wrapper 4; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (<any>t.skip)(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 72 }],
        name: 'node-skip wrapper 5; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (t satisfies object).skip(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 84 }],
        name: 'node-skip wrapper 6; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (t.skip satisfies Function)(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 86 }],
        name: 'node-skip wrapper 7; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (t as any).skip.call(t); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 80 }],
        name: 'node-skip wrapper 8; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (t as any).skip.apply(t, []); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 85 }],
        name: 'node-skip wrapper 9; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: "import { test } from 'node:test'; test('matrix', t => { (t as any).todo(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 57, endLine: 1, endColumn: 74 }],
        name: 'node-todo wrapper 0; conditional tickets false',
        settings: settings({ framework: 'node-test', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', ctx => { (ctx as any).skip(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 26, endLine: 1, endColumn: 45 }],
        name: 'vitest wrapper 0; conditional tickets false',
        settings: settings({ framework: 'vitest', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', ({}, info) => { (info as any).skip(); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 33, endLine: 1, endColumn: 53 }],
        name: 'playwright-info wrapper 0; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { (info as any).skip(); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 75 }],
        name: 'playwright-step wrapper 0; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { info!.skip(); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 67 }],
        name: 'playwright-step wrapper 1; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { (info.skip as any)(); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 75 }],
        name: 'playwright-step wrapper 2; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { (info.skip!)(); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 69 }],
        name: 'playwright-step wrapper 3; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { (<any>info).skip(); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 73 }],
        name: 'playwright-step wrapper 4; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { (<any>info.skip)(); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 73 }],
        name: 'playwright-step wrapper 5; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { (info satisfies object).skip(); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 85 }],
        name: 'playwright-step wrapper 6; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { (info.skip satisfies Function)(); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 87 }],
        name: 'playwright-step wrapper 7; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { (info as any).skip.call(info); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 84 }],
        name: 'playwright-step wrapper 8; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: " test('matrix', () => { test.step('nested', info => { (info as any).skip.apply(info, []); }); });",
        errors: [{ messageId: 'missingMarker', line: 1, column: 55, endLine: 1, endColumn: 89 }],
        name: 'playwright-step wrapper 9; conditional tickets false',
        settings: settings({ framework: 'playwright', requireTicketForConditional: false }),
      },
      {
        code: "const T = { tag: '@new' }; (T as any).tag = '@smoke'; test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 77, endLine: 1, endColumn: 82 }],
        name: 'Mutation operation 0, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
      {
        code: "const T = { tag: '@new' }; T!.tag = '@smoke'; test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 69, endLine: 1, endColumn: 74 }],
        name: 'Mutation operation 1, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
      {
        code: "const T = { tag: '@new' }; const A = T as typeof T; A.tag = '@smoke'; test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 93, endLine: 1, endColumn: 98 }],
        name: 'Mutation operation 2, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
      {
        code: "const T = { tag: '@new' }; const A = (0, T); A.tag = '@smoke'; test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 86, endLine: 1, endColumn: 91 }],
        name: 'Mutation operation 3, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
      {
        code: "const T = { tag: '@new' }; Object.assign(T, { tag: '@smoke' }); test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 87, endLine: 1, endColumn: 92 }],
        name: 'Mutation operation 4, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
      {
        code: "const T = { tag: '@new' }; Object.defineProperty(T, 'tag', { value: '@smoke' }); test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 104, endLine: 1, endColumn: 109 }],
        name: 'Mutation operation 5, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
      {
        code: "const T = { tag: '@new' }; Reflect.set(T, 'tag', '@smoke'); test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 83, endLine: 1, endColumn: 88 }],
        name: 'Mutation operation 6, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
      {
        code: "const T = { tag: '@new' }; Reflect.deleteProperty(T, 'tag'); test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 84, endLine: 1, endColumn: 89 }],
        name: 'Mutation operation 7, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
      {
        code: "const T = { tag: '@new' }; delete (T as any).tag; test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 73, endLine: 1, endColumn: 78 }],
        name: 'Mutation operation 8, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
      {
        code: "const T = { tag: '@new' }; (T as any).tag += 'x'; test('matrix', { tag: T.tag }, () => {});",
        errors: [{ messageId: 'dynamicTags', line: 1, column: 73, endLine: 1, endColumn: 78 }],
        name: 'Mutation operation 9, read 0, strict true',
        settings: settings({ framework: 'playwright', lifecycleTags: true, reportUnreadableTags: true }),
      },
    ],
  },
);
