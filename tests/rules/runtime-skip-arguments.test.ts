import rule from '../../src/rules/require-ticket.ts';
import { runRule, settings, withOptions } from '../helpers.ts';

for (const framework of ['mocha', 'cypress', 'webdriverio'] as const) {
  runRule(`require-ticket (${framework} runtime skip arguments)`, rule, {
    valid: withOptions({ framework }, [
      "it('fills an order', function () {\n  // SKIP: EXAMPLE-123\n  this.skip(false);\n});",
      "it('fills an order', function () {\n  if (condition) this.skip(false);\n});",
    ]),
    invalid: [
      ...withOptions(
        { framework },
        ['false', 'undefined', "''", "'ignored argument'", 'condition'].map((argument) => ({
          name: `requires a ticket when this.skip receives ${argument}`,
          code: `it('fills an order', function () { this.skip(${argument}); });`,
          errors: [
            {
              messageId: 'missingMarker',
              data: { subject: 'This skip call', state: 'skip', marker: 'SKIP', example: 'PROJ-123' },
            },
          ],
        })),
      ),
      {
        name: 'an outer condition still needs its reason when the ignored argument is false',
        code: "it('fills an order', function () { if (condition) this.skip(false); });",
        settings: settings({ framework, requireReasonForConditional: true }),
        errors: [
          {
            message:
              "This skip call is in the 'skip' state only under a condition and doesn't say why. Write the reason in a comment above it.",
          },
        ],
      },
    ],
  });
}
