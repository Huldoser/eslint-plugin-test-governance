import rule from '../../src/rules/no-conflicting-states.js';
import { runRule, settings } from '../helpers.js';

const lifecycle = settings({ lifecycleTags: true });
const custom = settings({ customStates: { quarantine: { when: '@quarantine', marker: 'QUARANTINE' } } });

runRule('no-conflicting-states', rule, {
  valid: [
    "test('a @New @unstabel', async () => {});",
    { code: "test('a @new', async () => {});", settings: lifecycle },
    { code: "test('a @unstable @smoke @news @neww', async () => {});", settings: lifecycle },
    { code: "test.skip('a @unstable', async () => {});", settings: lifecycle },
    { code: "test('a', async ({ browserName }) => { test.skip(browserName === 'webkit'); });", settings: lifecycle },
    { code: "test.describe('s @new', () => { test('a', async () => {}); });", settings: lifecycle },
    { code: "test('a @quarantine', async () => {});", settings: custom },
    // Real words two or more letters away in length are not typos.
    { code: "test('a @stable @untestable', async () => {});", settings: lifecycle },
    // Only @unstable is on: no @new checks.
    { code: "test.skip('a @new @unstable', async () => {});", settings: settings({ states: { unstable: true } }) },
    { code: "test('a @new @unstable', async () => {});", settings: settings({ states: { new: true } }) },
  ],
  invalid: [
    {
      code: "test('a @new @unstable', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndUnstable', data: { new: '@new', unstable: '@unstable' } }],
    },
    {
      code: "test.describe('s @unstable', () => {\n  test('a', { tag: '@new' }, async () => {});\n  test('b', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndUnstable', line: 2 }],
    },
    // Both tags inherited: reported once, on the describe where they first meet.
    {
      code: "test.describe('s @new', () => {\n  test.describe('t @unstable', () => {\n    test.describe('u', () => { test('a', async () => {}); });\n  });\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newAndUnstable', line: 2 }],
    },
    {
      code: "test.describe('s @new', () => { test('a @unstable', async () => {}); });",
      settings: lifecycle,
      errors: [{ messageId: 'newAndUnstable' }],
    },
    {
      code: "test.skip('a @new', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', data: { new: '@new' } }],
    },
    {
      code: "test.describe.fixme('s @new', () => {\n  test('a', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', line: 1 }],
    },
    {
      code: "test.describe('s @new', () => {\n  test.skip('a', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', line: 2, column: 3 }],
    },
    {
      code: "test.describe.skip('s', () => {\n  test('a @new', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', line: 2 }],
    },
    {
      code: "test('a @new', async () => {\n  test.skip();\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped' }],
    },
    {
      code: "test.describe('s', () => {\n  test.skip(true);\n  test('a @new', async () => {});\n});",
      settings: lifecycle,
      errors: [{ messageId: 'newSkipped', line: 3 }],
    },
    {
      code: "test('a @New', async () => {});",
      settings: lifecycle,
      output: "test('a @new', async () => {});",
      errors: [{ messageId: 'tagCase', data: { found: '@New', expected: '@new' } }],
    },
    {
      code: "test('a', { tag: ['@smoke', '@UNSTABLE'] }, async () => {});",
      settings: lifecycle,
      output: "test('a', { tag: ['@smoke', '@unstable'] }, async () => {});",
      errors: [{ messageId: 'tagCase', data: { found: '@UNSTABLE', expected: '@unstable' } }],
    },
    {
      code: "test('a @Quarantine x @Quarantine', async () => {});",
      settings: custom,
      output: "test('a @quarantine x @quarantine', async () => {});",
      errors: [{ messageId: 'tagCase' }, { messageId: 'tagCase' }],
    },
    // No fix when the tag is written with an escape in the source.
    {
      code: "test('a \\u0040New', async () => {});",
      settings: lifecycle,
      output: null,
      errors: [{ messageId: 'tagCase' }],
    },
    {
      code: "test('a @unstabel', async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'tagTypo', data: { found: '@unstabel', expected: '@unstable' } }],
    },
    {
      code: 'test(`a ${x} @quarantin`, async () => {});',
      settings: custom,
      errors: [{ messageId: 'tagTypo', data: { found: '@quarantin', expected: '@quarantine' } }],
    },
    {
      code: "test('a', { tag: ['@unstble', '@stable'] }, async () => {});",
      settings: lifecycle,
      errors: [{ messageId: 'tagTypo', data: { found: '@unstble', expected: '@unstable' } }],
    },
    {
      code: "test('a @qurantiine', async () => {});",
      settings: custom,
      errors: [{ messageId: 'tagTypo', data: { found: '@qurantiine', expected: '@quarantine' } }],
    },
  ],
});
