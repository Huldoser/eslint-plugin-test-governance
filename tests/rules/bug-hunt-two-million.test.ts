import requireTicket from '../../src/rules/require-ticket.ts';
import limitRetries from '../../src/rules/limit-retries.ts';
import { runRule, withOptions } from '../helpers.ts';

runRule('limit-retries (writes through selected conditional references)', limitRetries, {
  valid: withOptions({ checkConfigRetries: true }, [
    'const source = { count: 7 }; const alias = true ? source : {}; alias.count = external; export default { retries: source.count };',
    'const source = { count: 7 }; const alias = false ? {} : source; alias.count = external; export default { retries: source.count };',
    'const source = { count: 7 }; const alias = enabled ? source : {}; alias.count = external; export default { retries: source.count };',
    'const source = { count: 7 }; const alias = enabled ? {} : source; alias.count = external; export default { retries: source.count };',
    'const source = { count: 7 }; const alias = enabled ? source : source; alias.count = external; export default { retries: source.count };',
    'const selected = true; const source = { count: 7 }; const alias = selected ? source : {}; Reflect.set(alias, "count", external); export default { retries: source.count };',
    'const source = { count: 7 }; const alias = !false ? source : {}; Object.assign(alias, { count: external }); export default { retries: source.count };',
    'const source = { count: 7 }; const alias = (enabled ? true : true) ? source : {}; delete alias.count; export default { retries: source.count };',
    'const source = { nested: { count: 7 } }; const alias = true ? source.nested : {}; alias.count = external; test.describe.configure({ retries: source.nested.count });',
  ]),
  invalid: withOptions({ checkConfigRetries: true }, [
    {
      code: 'const source = { count: 7 }; const alias = false ? source : {}; alias.count = external; export default { retries: source.count };',
      errors: [{ messageId: 'excessiveRetries' }],
    },
    {
      code: 'const source = { count: 7 }; const alias = true ? {} : source; alias.count = external; export default { retries: source.count };',
      errors: [{ messageId: 'excessiveRetries' }],
    },
    {
      code: 'const source = { count: 7 }; const alias = true ? source.count : 0; Object.assign(alias, { unused: 1 }); export default { retries: source.count };',
      errors: [{ messageId: 'excessiveRetries' }],
    },
    {
      code: 'const source = { count: 7 }; const alias = enabled ? source.count : 0; Object.assign(alias, { unused: 1 }); export default { retries: source.count };',
      errors: [{ messageId: 'excessiveRetries' }],
    },
  ]),
});

runRule('require-ticket (conditional reference writes make the source tags unreadable)', requireTicket, {
  valid: [],
  invalid: withOptions({ customStates: { hold: { when: '@hold', marker: 'HOLD' } }, reportUnreadableTags: true }, [
    {
      code: "const source = { tag: '@open' }; const alias = true ? source : {}; alias.tag = external; test('selected tag', { tag: source.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
    },
    {
      code: "const source = { tag: '@open' }; const alias = enabled ? source : {}; Object.defineProperty(alias, 'tag', { value: external }); test('possible tag', { tag: source.tag }, () => {});",
      errors: [{ messageId: 'dynamicTags' }],
    },
    {
      code: "const source = { tag: '@hold' }; const alias = true ? {} : source; alias.tag = external; test('unreachable write', { tag: source.tag }, () => {});",
      errors: [{ messageId: 'missingMarker' }],
    },
  ]),
});

runRule('require-ticket (conditional aliases invalidate reason and annotation tickets)', requireTicket, {
  valid: withOptions({ ticketsFromReasons: true }, [
    "const source = { reason: 'EXAMPLE-271' }; const alias = false ? source : {}; alias.reason = external; test.skip(true, source.reason);",
  ]),
  invalid: [
    ...withOptions({ ticketsFromReasons: true }, [
      {
        code: "const source = { reason: 'EXAMPLE-271' }; const alias = true ? source : {}; alias.reason = external; test.skip(true, source.reason);",
        errors: [{ messageId: 'missingMarker' }],
      },
      {
        code: "const source = { reason: 'EXAMPLE-271' }; const alias = enabled ? source : {}; alias.reason = external; test.skip(true, source.reason);",
        errors: [{ messageId: 'missingMarker' }],
      },
    ]),
    ...withOptions({ annotations: { only: true }, reportUnreadableTags: true }, [
      {
        code: "const source = { ticket: 'EXAMPLE-271' }; const alias = true ? source : {}; alias.ticket = external; test.skip('changed ticket', { annotation: { type: 'issue', description: source.ticket } }, () => {});",
        errors: [{ messageId: 'missingAnnotation' }, { messageId: 'unreadAnnotation' }],
      },
    ]),
  ],
});
