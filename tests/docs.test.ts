import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import testGovernance from '../src/index.ts';

const docsDir = path.resolve(import.meta.dirname, '../docs/rules');
const EXAMPLE_RE = /<!-- example: (valid|invalid)(?: settings=(\{.*?\}))? -->\n+```(js|ts)\n([\s\S]*?)```/g;

// Every example in the rule docs runs, so a "correct" example can never start failing silently.
for (const file of readdirSync(docsDir).filter((f) => f.endsWith('.md'))) {
  describe(file, () => {
    const rule = file.replace(/\.md$/, '');
    const text = readFileSync(path.join(docsDir, file), 'utf8');
    const examples = [...text.matchAll(EXAMPLE_RE)];

    it('has valid and invalid examples', () => {
      assert.ok(examples.some((m) => m[1] === 'valid'));
      assert.ok(examples.some((m) => m[1] === 'invalid'));
    });

    for (const [n, kind, settings, lang, code] of examples.map((m, i) => [i + 1, m[1], m[2], m[3], m[4]] as const)) {
      it(`example ${n} is ${kind}`, () => {
        const linter = new Linter();
        const messages = linter.verify(
          code,
          [
            {
              files: ['**/*'],
              languageOptions: lang === 'ts' ? { parser: tsParser } : {},
              plugins: { 'test-governance': testGovernance },
              rules: { [`test-governance/${rule}`]: 'error' },
              settings: { 'test-governance': settings ? (JSON.parse(settings) as Record<string, unknown>) : {} },
            },
          ],
          `example.spec.${lang}`,
        );
        assert.deepEqual(
          messages.filter((m) => m.fatal),
          [],
        );
        if (kind === 'valid') assert.deepEqual(messages, []);
        else assert.ok(messages.length > 0);
      });
    }
  });
}
