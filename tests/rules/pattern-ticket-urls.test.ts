import rule from '../../src/rules/require-ticket.ts';
import type { TicketSpec } from '../../src/utils/tickets.ts';
import { runRule, withOptions } from '../helpers.ts';

const pattern: TicketSpec = { preset: 'pattern', pattern: '\\S+' };
const url: TicketSpec = { preset: 'url', hosts: ['tracker.example.com'] };

for (const [name, ticket] of [
  ['pattern', pattern],
  ['any then pattern', [{ preset: 'any' }, pattern]],
  ['pattern then any', [pattern, { preset: 'any' }]],
  ['url then pattern', [url, pattern]],
  ['pattern then url', [pattern, url]],
] satisfies [string, TicketSpec | TicketSpec[]][]) {
  runRule(`require-ticket (URL IDs with ${name})`, rule, {
    valid: withOptions(
      { ticket },
      [
        'https://tracker.example.com/EXAMPLE-1/retry-count-0',
        'https://tracker.example.com/item?id=0/0',
        'https://tracker.example.com/item?page=0',
        'EXAMPLE-1',
      ].map((value) => `// SKIP: ${value}\ntest.skip('fills an order', () => {});`),
    ),
    invalid: withOptions(
      { ticket },
      [
        'https://tracker.example.com/item?id=0',
        'https://tracker.example.com/EXAMPLE-0/details',
        'https://tracker.example.com/#/EXAMPLE-0/details',
        'EXAMPLE-0',
      ].map((value) => ({
        code: `// SKIP: ${value}\ntest.skip('fills an order', () => {});`,
        errors: [{ messageId: 'placeholderTicket' as const, data: { ticket: value } }],
      })),
    ),
  });
}
