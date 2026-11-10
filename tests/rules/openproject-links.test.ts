import rule from '../../src/rules/require-ticket.ts';
import { runRule, withOptions } from '../helpers.ts';

const options = { ticket: { preset: 'openproject', host: 'tracker.example.com' } } as const;

runRule('require-ticket (OpenProject links)', rule, {
  valid: withOptions(
    options,
    [
      '/openproject/work_packages/24971',
      '/tools/openproject/wp/80962',
      '/work_packages/AGILE-1',
      '/wp/AGILE-1',
      '/openproject/wp/AGILE-42/activity',
      '/projects/AGILE/work_packages/AGILE-1/activity?comment=0',
    ].map((path) => `// SKIP: https://tracker.example.com${path}\ntest.skip('fills an order', () => {});`),
  ),
  invalid: withOptions(
    options,
    [
      '/projects/AGILE/work_packages/AGILE-0/activity',
      '/work_packages/AGILE-000/activity',
      '/openproject/wp/AGILE-0',
      '/openproject/work_packages/0/activity',
    ].map((path) => {
      const ticket = `https://tracker.example.com${path}`;
      return {
        code: `// SKIP: ${ticket}\ntest.skip('fills an order', () => {});`,
        errors: [{ messageId: 'placeholderTicket' as const, data: { ticket } }],
      };
    }),
  ),
});
