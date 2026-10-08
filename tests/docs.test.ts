import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import testGovernance from '../src/index.ts';
import { TICKET_PRESETS } from '../src/utils/constants.ts';
import { optionsSchema } from '../src/utils/schema.ts';

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

const readme = readFileSync(path.resolve(import.meta.dirname, '../README.md'), 'utf8');

/** The backticked names in the first column of the first table after `heading` in the README. */
function tableNames(heading: string): string[] {
  const lines = readme.split('\n');
  const header = lines.findIndex((line, i) => i > lines.indexOf(heading) && line.startsWith('|'));
  const names: string[] = [];
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    names.push(/^\|\s*`([^`]+)`/.exec(line)?.[1] ?? line);
  }
  return names;
}

describe('README.md', () => {
  it('documents every option', () => {
    assert.deepEqual(tableNames('## Options').sort(), Object.keys(optionsSchema.properties ?? {}).sort());
  });

  it('documents every ticket preset', () => {
    assert.deepEqual(tableNames('### Ticket presets').sort(), [...TICKET_PRESETS].sort());
  });

  it('has only valid options in its configure() examples', () => {
    const blocks = [...readme.matchAll(/```(?:js|ts)\n([\s\S]*?)```/g)].map((m) => m[1]);
    const examples = blocks.flatMap((code) =>
      [...code.matchAll(/configure\(\{/g)].map((m) => {
        const start = m.index + 'configure('.length;
        let depth = 0;
        let end = start;
        do {
          if (code[end] === '{') depth++;
          else if (code[end] === '}') depth--;
          end++;
        } while (depth > 0);
        return code.slice(start, end);
      }),
    );
    assert.ok(examples.length >= 2);
    for (const example of examples) {
      const options = runInNewContext(`(${example})`) as Record<string, unknown>;
      assert.doesNotThrow(() => testGovernance.configure(options), example);
    }
  });
});
