import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import testGovernance from '../src/index.js';

const docsDir = path.resolve(import.meta.dirname, '../docs/rules');
const EXAMPLE_RE = /<!-- example: (valid|invalid)(?: settings=(\{.*?\}))? -->\n+```(js|ts)\n([\s\S]*?)```/g;

// Every example in the rule docs runs, so a "correct" example can never start failing silently.
describe.each(readdirSync(docsDir).filter((f) => f.endsWith('.md')))('%s', (file) => {
  const rule = file.replace(/\.md$/, '');
  const text = readFileSync(path.join(docsDir, file), 'utf8');
  const examples = [...text.matchAll(EXAMPLE_RE)];

  it('has valid and invalid examples', () => {
    expect(examples.some((m) => m[1] === 'valid')).toBe(true);
    expect(examples.some((m) => m[1] === 'invalid')).toBe(true);
  });

  it.each(examples.map((m, i) => [i + 1, m[1], m[2], m[3], m[4]] as const))(
    'example %i is %s',
    (_, kind, settings, lang, code) => {
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
      expect(messages.filter((m) => m.fatal)).toEqual([]);
      if (kind === 'valid') expect(messages).toEqual([]);
      else expect(messages.length).toBeGreaterThan(0);
    },
  );
});
