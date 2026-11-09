import rule from '../../src/rules/require-ticket.ts';
import commentRule from '../../src/rules/require-ticket-in-comments.ts';
import { runRule, settings } from '../helpers.ts';

const missing = (state = 'skip', marker = 'SKIP') => ({
  messageId: 'missingMarker' as const,
  data: { subject: 'This test', state, marker, example: 'PROJ-123' },
});
const lifecycle = settings({
  customStates: { new: { when: '@new', marker: 'NEW' }, quarantined: { when: '@quarantined', marker: 'QUARANTINED' } },
});

runRule('require-ticket (analysis regressions)', rule, {
  valid: [
    {
      code: "import { test } from 'node:test'; test('fills', t => { rows.forEach(t => t.skip()); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      code: "import { test } from 'node:test'; test('fills', t => { { const t = helper; t.skip(); } });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      code: "import { test } from 'node:test'; test('fills', t => { rows.forEach(t => { const skip = t.skip; skip(); }); });",
      settings: settings({ framework: 'node-test' }),
    },
    {
      code: "test('fills', async ({}, info) => { helpers.forEach(info => info.skip()); });",
    },
    {
      code: "import { test } from 'node:test'; test('fills', t => { rows.forEach(t => t.test('helper', {skip:true}, () => {})); });",
      settings: settings({ framework: 'node-test' }),
    },
    ...[false, true].map((requireTicketForConditional) => ({
      code: "test('fills', () => { test.skip(false); test.info().fixme(false); });",
      settings: settings({ requireReasonForConditional: true, requireTicketForConditional }),
    })),
    {
      code: "test('fills', { ...{skip:true}, skip:false }, () => {});",
      settings: settings({ framework: 'vitest' }),
    },
    {
      code: "test('fills', { ...{retry:2}, retry:0 }, () => {});",
      settings: settings({ framework: 'vitest', states: { retry: true } }),
    },
    ...[
      "const TAGS = [...['@smoke', '@regression'], '@new']; test('fills', {tag:TAGS[1]}, () => {});",
      "const TAGS = ['@smoke', '@new']; test('fills', {tag:TAGS['01']}, () => {});",
      "test('fills', {...{tag:'@new'}, tag:'@smoke'}, () => {});",
      "test('fills', {tag:'@new', ...{tag:'@smoke'}}, () => {});",
      "test('fills', {tag:'@new', ...external}, () => {});",
      "test('fills', {tag:'@new', [key]:'@smoke'}, () => {});",
      "const TAGS = ['@smoke']; test('fills', {tag:TAGS[4]}, () => {});",
      "const TAGS = ['@smoke']; test('fills', {tag:TAGS['-1']}, () => {});",
      "const TAGS = ['@smoke']; test('fills', {tag:TAGS[0.5]}, () => {});",
      "const A = {...A}; test('fills', A, () => {});",
      "const A = {...B}; const B = {...A}; test('fills', A, () => {});",
      "const a = b; const b = a; a.skip('fills', () => {});",
    ].map((code) => ({ code, settings: lifecycle })),
    "const A = [{type:'issue',description:'PROJ-1'}]; test.skip('fills', {annotation:[...A]}, () => {});",
    "const A = [{type:'issue',description:'PROJ-1'}]; const B = [...A]; test.skip('fills', {annotation:[...B]}, () => {});",
    "const A = [...A]; test('fills', {annotation:A}, () => {});",
    "test('fills', {annotation:[...external]}, () => {});",
    "describe('fills', () => {});",
  ],
  invalid: [
    {
      code: "const TAGS = ['@new', ...external]; test('fills', {tag:TAGS[0]}, () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    {
      code: "describe('orders', () => { const check = it; check.skip('fills', () => {}); });",
      settings: settings({ framework: 'jest' }),
      errors: [missing()],
    },
    {
      code: "const first = enabled ? it.skip : it; const second = first; second('fills', () => {});",
      settings: settings({ framework: 'jest', requireTicketForConditional: true }),
      errors: [missing()],
    },
    {
      code: "describe('orders', () => { const check = it; const again = check; again.skip('fills', () => {}); });",
      settings: settings({ framework: 'jest' }),
      errors: [missing()],
    },
    {
      code: "test('fills', {tag:'@smoke', ...{tag:'@new'}}, () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    {
      code: "test('fills', {...external, tag:'@new'}, () => {});",
      settings: lifecycle,
      errors: [missing('new', 'NEW')],
    },
    {
      code: "test.skip('fills', {...{annotation:{type:'issue',description:'PROJ-1'}},annotation:[]}, () => {});",
      errors: [missing()],
    },
    {
      code: "test.skip('fills', {annotation:{type:'issue',...{description:'PROJ-1'},description:'TBD'}}, () => {});",
      errors: [
        missing(),
        {
          messageId: 'invalidAnnotation',
          data: {
            ticket: 'TBD',
            state: 'skip',
            expected: 'a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL',
          },
        },
      ],
    },
    {
      code: "test.skip('fills', {annotation:{type:'issue',...{type:'note'},description:'PROJ-1'}}, () => {});",
      errors: [missing()],
    },
    {
      code: "test.skip('fills', {annotation:[...external]}, () => {});",
      settings: settings({ reportUnreadableTags: true }),
      errors: [missing(), { messageId: 'unreadAnnotation' }],
    },
  ],
});

runRule('require-ticket-in-comments (mixed block)', commentRule, {
  valid: [],
  invalid: [
    {
      code: "/*\n * SKIP: PROJ-1\n * TODO: repair the fixture\n */\ntest.skip('fills', () => {});",
      errors: [{ messageId: 'missingTicket', data: { keyword: 'TODO', upper: 'TODO', example: 'PROJ-123' } }],
    },
  ],
});
