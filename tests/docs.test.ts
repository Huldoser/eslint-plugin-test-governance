import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';
import testGovernance from '../src/index.ts';
import { BUILTIN_STATE_NAMES, FRAMEWORK_NAMES, TICKET_PRESETS, type FrameworkName } from '../src/utils/constants.ts';
import { compileOptions } from '../src/utils/options.ts';
import { optionsSchema } from '../src/utils/schema.ts';
import { DEFAULT_PLACEHOLDERS, type TicketMatcher } from '../src/utils/tickets.ts';

// The docs repeat facts the code also states: rule names, options and their defaults, ticket presets,
// frameworks, exported types, supported versions. These tests compare the two, so a change to the code
// that leaves the docs behind fails CI. CONTRIBUTING.md lists what to update for each kind of change.

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');
const REPO_URL = 'https://github.com/Huldoser/eslint-plugin-test-governance';

const ruleDocs = readdirSync(path.join(root, 'docs/rules'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => `docs/rules/${f}`);
const readme = read('README.md');
const contributing = read('CONTRIBUTING.md');
const packageJson = JSON.parse(read('package.json')) as {
  description: string;
  keywords: string[];
  scripts: Record<string, string>;
  engines: { node: string };
  peerDependencies: { eslint: string };
};
const optionNames = Object.keys(optionsSchema.properties ?? {}).sort();

/** The text of each inline code span in `text`. */
const codeSpans = (text: string): string[] => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/**
 * Evaluates a JavaScript literal from the docs, such as `{ preset: 'any' }`, with `names` in scope. The copy
 * turns its arrays and objects into this realm's, so `assert.deepEqual` can compare them with the code's.
 */
const evaluate = (literal: string, names: Record<string, unknown> = {}): unknown =>
  structuredClone(runInNewContext(`(${literal})`, { ...names }));

/** The rows of the first table after `heading`, header row first, each split into cells. */
function table(text: string, heading: string): string[][] {
  const lines = text.split('\n');
  const start = lines.indexOf(heading);
  assert.notEqual(start, -1, `missing heading "${heading}"`);
  const first = lines.findIndex((line, i) => i > start && line.startsWith('|'));
  const rows: string[][] = [];
  for (const line of lines.slice(first)) {
    if (!line.startsWith('|')) break;
    rows.push(
      line
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((cell) => cell.trim()),
    );
  }
  // Leave out the `| --- |` row under the header.
  return [rows[0], ...rows.slice(2)];
}

/** The body rows of a table whose first column holds backticked names, by name. */
function rowsByName(rows: string[][]): Map<string, string[]> {
  return new Map(rows.slice(1).map((row) => [/^`([^`]+)`/.exec(row[0])?.[1] ?? row[0], row]));
}

/** The paragraph of `text` that contains `phrase`. */
function paragraph(text: string, phrase: string): string {
  const found = text.split('\n\n').find((p) => p.includes(phrase));
  assert.ok(found, `no paragraph contains "${phrase}"`);
  return found;
}

interface Example {
  kind: 'valid' | 'invalid';
  settings: Record<string, unknown>;
  lang: 'js' | 'ts';
  code: string;
}

const EXAMPLE_RE = /<!-- example: (valid|invalid)(?: settings=(\{.*?\}))? -->\n+```(js|ts)\n([\s\S]*?)```/g;

/** The code blocks marked `<!-- example: valid -->` or `<!-- example: invalid -->` in `text`. */
function examples(text: string): Example[] {
  return [...text.matchAll(EXAMPLE_RE)].map((m) => ({
    kind: m[1] as Example['kind'],
    settings: m[2] ? (JSON.parse(m[2]) as Record<string, unknown>) : {},
    lang: m[3] as Example['lang'],
    code: m[4],
  }));
}

/** Lints an example with `rules` on, and checks a valid one gets no messages and an invalid one some. */
function checkExample(example: Example, rules: Linter.RulesRecord): void {
  const messages = new Linter().verify(
    example.code,
    [
      {
        // A pattern that names the extension: ESLint skips a `.ts` file that only `**/*` matches.
        files: [`**/*.${example.lang}`],
        languageOptions: example.lang === 'ts' ? { parser: tsParser } : {},
        plugins: { 'test-governance': testGovernance },
        rules,
        settings: { 'test-governance': example.settings },
      },
    ],
    `example.spec.${example.lang}`,
  );
  assert.deepEqual(
    messages.filter((m) => m.fatal),
    [],
  );
  if (example.kind === 'valid') {
    assert.deepEqual(messages, []);
  } else {
    assert.ok(messages.length > 0);
    // Only the rules report it, not ESLint itself, as it does for a file no config applies to.
    assert.deepEqual(
      messages.filter((m) => !m.ruleId?.startsWith('test-governance/')),
      [],
    );
  }
}

// Every example in the rule docs runs, so a "correct" example can never start failing silently.
for (const file of ruleDocs) {
  describe(file, () => {
    const rule = path.basename(file, '.md');
    const found = examples(read(file));

    it('has valid and invalid examples', () => {
      assert.ok(found.some((example) => example.kind === 'valid'));
      assert.ok(found.some((example) => example.kind === 'invalid'));
    });

    found.forEach((example, i) => {
      it(`example ${i + 1} is ${example.kind}`, () => {
        checkExample(example, { [`test-governance/${rule}`]: 'error' });
      });
    });
  });
}

describe('README.md', () => {
  const found = examples(readme);

  it('marks its code samples as examples', () => {
    assert.ok(found.length > 0);
  });

  found.forEach((example, i) => {
    it(`example ${i + 1} is ${example.kind} with all the rules on`, () => {
      checkExample(example, testGovernance.configs.playwright.rules);
    });
  });

  it('documents every option', () => {
    assert.deepEqual([...rowsByName(table(readme, '## Options')).keys()].sort(), optionNames);
  });

  it('documents every ticket preset', () => {
    assert.deepEqual([...rowsByName(table(readme, '### Ticket presets')).keys()].sort(), [...TICKET_PRESETS].sort());
  });

  it('has only valid options in its configure() examples', () => {
    /** The object literal that starts at `start` in `code`. */
    const objectAt = (code: string, start: number): string => {
      let depth = 0;
      let end = start;
      do {
        if (code[end] === '{') depth++;
        else if (code[end] === '}') depth--;
        end++;
      } while (depth > 0);
      return code.slice(start, end);
    };
    const blocks = [...readme.matchAll(/```(?:js|ts)\n([\s\S]*?)```/g)].map((m) => m[1]);
    const configureExamples = blocks.flatMap((code) => {
      // Objects the block keeps in a constant, as in `const options = {...}`, for the examples that spread them.
      const constants = Object.fromEntries(
        [...code.matchAll(/^const (\w+) = (?=\{)/gm)].map((m) => [
          m[1],
          evaluate(objectAt(code, m.index + m[0].length)),
        ]),
      );
      return [...code.matchAll(/configure\(\{/g)].map((m) => ({
        literal: objectAt(code, m.index + 'configure('.length),
        constants,
      }));
    });
    assert.ok(configureExamples.length >= 2);
    for (const { literal, constants } of configureExamples) {
      const options = evaluate(literal, constants) as Record<string, unknown>;
      assert.doesNotThrow(() => testGovernance.configure(options), literal);
    }
  });

  it('shows the error configure() really gives for a mistyped option', () => {
    const sample = /validates the options[\s\S]*?```text\n([\s\S]*?)```/.exec(readme)?.[1];
    assert.ok(sample);
    // `…` in the sample stands for text left out.
    const pattern = new RegExp(
      `^${sample
        .trimEnd()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replaceAll('…', '.*')}$`,
    );
    const options: Record<string, unknown> = { lifecycleTag: true, ticket: { preset: 'jria' } };
    assert.throws(
      () => testGovernance.configure(options),
      (error: Error) => pattern.test(error.message),
    );
  });

  it('lists the options each ticket preset takes', () => {
    const ticketOptions = Object.keys(optionsSchema.properties?.ticket.anyOf?.[0].properties ?? {}).filter(
      (key) => key !== 'preset',
    );
    // A value of the right type for each option, so only options the preset ignores are reported.
    const samples: Record<string, unknown> = {
      projects: ['TRADE'],
      teams: ['RISK'],
      host: 'tickets.example.com',
      minLength: 1,
      maxLength: 9,
      pattern: 'TRADE-\\d+',
      flags: 'i',
    };
    assert.deepEqual(Object.keys(samples).sort(), ticketOptions.sort());
    const takes = (preset: string, key: string): boolean => {
      try {
        testGovernance.configure({ ticket: { preset, [key]: samples[key] } } as Record<string, unknown>);
      } catch (error) {
        return !(error as Error).message.includes(`ticket.${key} is not an option`);
      }
      return true;
    };
    for (const [preset, row] of rowsByName(table(readme, '### Ticket presets'))) {
      const listed = codeSpans(row[2]).filter((name) => ticketOptions.includes(name));
      assert.deepEqual(
        listed.sort(),
        ticketOptions.filter((key) => takes(preset, key)).sort(),
        `options of the "${preset}" preset`,
      );
    }
  });

  it('has a column for each framework in the framework table', () => {
    const [header] = table(readme, '### Frameworks');
    assert.deepEqual(
      header.slice(1).map((cell) => cell.toLowerCase()),
      [...FRAMEWORK_NAMES],
    );
  });

  it('names every config', () => {
    for (const name of Object.keys(testGovernance.configs)) assert.ok(readme.includes(`configs.${name}`), name);
  });

  it('lists every exported type', () => {
    const listed = codeSpans(paragraph(readme, 'it exports these types:')).filter((name) => /^[A-Z]\w*$/.test(name));
    const source = read('src/index.ts');
    const exported = [
      ...[...source.matchAll(/^export type \{([^}]+)\}/gm)].flatMap((m) => m[1].split(',').map((name) => name.trim())),
      ...[...source.matchAll(/^export (?:type|interface) (\w+)/gm)].map((m) => m[1]),
    ];
    assert.deepEqual(listed.sort(), exported.sort());
  });
});

describe('option defaults', () => {
  const options = table(readme, '## Options');
  const defaultColumn = options[0].indexOf('Default');
  const descriptionColumn = options[0].indexOf('Description');
  const optionRows = rowsByName(options);
  const defaultsRows = new Map(table(readme, '## Defaults').map((row) => [row[0], row[1]]));

  // Tickets that tell the presets and placeholders apart.
  const SAMPLE_TICKETS = [
    'TRADE-123',
    '#123',
    'acme/trading-engine#123',
    'AB#123',
    '4821',
    'https://acme.atlassian.net/browse/TRADE-123',
    'https://github.com/acme/trading-engine/issues/123',
    'TODO',
    'TRADE-0',
    'flaky',
  ];
  const judge = (matcher: TicketMatcher): string[] => [
    matcher.expected,
    ...SAMPLE_TICKETS.map((t) => matcher.check(t)),
  ];

  /** What the rules see for `options`, with each ticket format reduced to how it judges sample tickets. */
  function resolved(options: Record<string, unknown>): unknown {
    const { framework, testFunctions, states, workCommentKeywords, commentTicket, ...rest } = compileOptions(options);
    return {
      ...rest,
      framework: framework.name,
      testFunctions: [...testFunctions],
      states: states.map(({ ticket, ...state }) => ({ ...state, ticket: judge(ticket) })),
      workCommentKeywords: [...workCommentKeywords],
      commentTicket: judge(commentTicket),
    };
  }

  const statesOn = (framework: FrameworkName): string[] =>
    compileOptions({ framework })
      .states.map((state) => state.name)
      .sort();

  /** The doc comment of each `GovernanceOptions` property, which editors show on hover. */
  const hoverDocs = new Map<string, string>();
  const body = /^export interface GovernanceOptions \{\n([\s\S]*?)\n\}/m.exec(read('src/utils/options.ts'))?.[1] ?? '';
  let doc = '';
  for (const line of body.split('\n')) {
    const property = /^ {2}(\w+)\?:/.exec(line);
    if (property) {
      hoverDocs.set(property[1], doc.replace(/\s+/g, ' ').trim());
      doc = '';
    } else {
      doc += ` ${line.trim().replace(/^\/\*\*|^\*\/$|^\*(?!\/)|\*\/$/g, '')}`;
    }
  }

  it('gives every option a hover doc', () => {
    assert.deepEqual([...hoverDocs.keys()].sort(), optionNames);
    for (const [name, text] of hoverDocs) assert.ok(text, name);
  });

  it('lists the defaults the rules use', () => {
    for (const [name, row] of optionRows) {
      // These two defaults are lists in prose, checked by the tests below.
      if (name === 'placeholders' || name === 'states') continue;
      const literal = /^`([^`]+)`$/.exec(row[defaultColumn])?.[1];
      assert.ok(literal, `the default of ${name} is a single code span`);
      assert.deepEqual(resolved({ [name]: evaluate(literal) }), resolved({}), `${name} defaults to ${literal}`);
    }
  });

  it('gives the same defaults in the hover docs as in the README', () => {
    for (const [name, text] of hoverDocs) {
      const literal = /Defaults to `([^`]+)`/.exec(text)?.[1];
      if (literal === undefined) continue;
      const documented = /^`([^`]+)`$/.exec(optionRows.get(name)?.[defaultColumn] ?? '')?.[1] ?? '';
      assert.deepEqual(evaluate(literal), evaluate(documented), name);
    }
  });

  it('lists the test functions Jest and Vitest use by default', () => {
    const literal = /Jest and Vitest default to `([^`]+)`/.exec(
      optionRows.get('testFunctions')?.[descriptionColumn] ?? '',
    )?.[1];
    assert.ok(literal);
    for (const framework of ['jest', 'vitest'] as const) {
      assert.deepEqual(resolved({ framework, testFunctions: evaluate(literal) }), resolved({ framework }), framework);
    }
    assert.ok(hoverDocs.get('testFunctions')?.includes(`\`${literal}\` for Jest and Vitest`));
  });

  it('lists the default placeholders', () => {
    // The `0` placeholder is the "numbered 0" in the text.
    const expected = DEFAULT_PLACEHOLDERS.filter((placeholder) => placeholder !== '0');
    const readmeList = defaultsRows.get('Placeholder tickets')?.split('numbered 0')[0] ?? '';
    assert.deepEqual(codeSpans(readmeList), expected);
    const hoverList = /default one \(([^)]*)\)/.exec(hoverDocs.get('placeholders') ?? '')?.[1] ?? '';
    assert.deepEqual(codeSpans(hoverList), expected);
  });

  it('lists every built-in state', () => {
    const description = optionRows.get('states')?.[descriptionColumn] ?? '';
    const listed = /built-in states \(([^)]*)\)/.exec(description)?.[1] ?? '';
    assert.deepEqual(codeSpans(listed), [...BUILTIN_STATE_NAMES]);
  });

  it('lists the states that are on by default', () => {
    const listed = codeSpans(optionRows.get('states')?.[defaultColumn] ?? '').sort();
    assert.deepEqual(listed, [...new Set(FRAMEWORK_NAMES.flatMap(statesOn))].sort());

    const [playwright, jestAndVitest] = (defaultsRows.get('States that need a ticket') ?? '').split(
      '; in Jest and Vitest',
    );
    assert.deepEqual(codeSpans(playwright).sort(), statesOn('playwright'));
    assert.deepEqual(codeSpans(jestAndVitest).sort(), statesOn('jest'));
    assert.deepEqual(codeSpans(jestAndVitest).sort(), statesOn('vitest'));
  });

  it('lists the rules that only warn', () => {
    const warn = Object.entries(testGovernance.configs.playwright.rules)
      .filter(([, severity]) => severity === 'warn')
      .map(([name]) => name.replace('test-governance/', ''));
    const severity = defaultsRows.get('Severity') ?? '';
    assert.deepEqual(codeSpans(severity.split('every other rule')[0]), warn);
  });

  it('names only real options on the rule pages, and every option on at least one', () => {
    const mentioned = new Set<string>();
    for (const file of ruleDocs) {
      const section = read(file).split(/^## Options$/m)[1];
      assert.ok(section, `${file} has an Options section`);
      // The names before the colon of each list item, leaving out state names such as `new`.
      for (const [, item] of section.matchAll(/^- ([^:\n]*)/gm)) {
        for (const name of codeSpans(item)) {
          if ((BUILTIN_STATE_NAMES as readonly string[]).includes(name)) continue;
          assert.ok(optionNames.includes(name), `${file}: ${name} is not an option`);
          mentioned.add(name);
        }
      }
    }
    assert.deepEqual([...mentioned].sort(), optionNames);
  });
});

describe('supported versions', () => {
  const ci = read('.github/workflows/ci.yml');
  const oldestNode = /^>=(\d+\.\d+)$/.exec(packageJson.engines.node)?.[1];
  const eslintRanges = packageJson.peerDependencies.eslint.split('||').map((range) => range.trim());
  const eslintMajors = eslintRanges.map((range) => /^\^(\d+)\.0\.0$/.exec(range)?.[1]);
  const oldestEslint = eslintRanges[0].slice(1);
  /** `['9', '10', '11']` as "9, 10 or 11". */
  const list = (items: unknown[], and: string): string =>
    items.length > 1 ? `${items.slice(0, -1).join(', ')} ${and} ${String(items.at(-1))}` : String(items[0]);
  const ciList = (key: string): string[] =>
    (new RegExp(`^\\s+${key}: \\[([^\\]]+)\\]`, 'm').exec(ci)?.[1] ?? '').split(',').map((v) => v.trim());
  /** Checks that `text` says `sentence`, wherever its lines break. */
  const says = (text: string, sentence: string): void => {
    assert.ok(text.replace(/\s+/g, ' ').includes(sentence), `expected the text to say "${sentence}"`);
  };

  it('match package.json in the README', () => {
    says(readme, `Requires ESLint ${list(eslintMajors, 'or')} with flat config, and Node.js ${oldestNode} or later.`);
  });

  it('match package.json in the CI matrix', () => {
    assert.deepEqual(ciList('eslint'), eslintMajors);
    says(ci, `node-version: ${oldestNode}.0`);
    says(ci, `eslint@${oldestEslint}`);
  });

  it('match the CI matrix in CONTRIBUTING.md', () => {
    says(contributing, `Requires Node.js ${oldestNode} or later.`);
    says(
      contributing,
      `tests on Node ${list(ciList('node'), 'and')} with ESLint ${list(eslintMajors, 'and')}, plus the oldest supported versions, Node ${oldestNode} with ESLint ${oldestEslint}`,
    );
  });

  it('match the TypeScript version the package is tested with', () => {
    const tested = /const OLDEST_TYPESCRIPT = '([\d.]+)'/.exec(read('scripts/pack-smoke.mjs'))?.[1];
    assert.ok(tested);
    says(readme, `work with TypeScript ${tested} or later`);
  });
});

describe('package.json', () => {
  it('names every framework in its description and keywords', () => {
    for (const framework of FRAMEWORK_NAMES) {
      assert.ok(packageJson.description.toLowerCase().includes(framework), framework);
      assert.ok(packageJson.keywords.includes(framework), framework);
    }
  });
});

describe('links between docs', () => {
  const markdown = [
    'README.md',
    'CONTRIBUTING.md',
    'CHANGELOG.md',
    'SECURITY.md',
    'CODE_OF_CONDUCT.md',
    '.github/pull_request_template.md',
    ...ruleDocs,
  ];
  const withoutCodeBlocks = (text: string): string => text.replace(/^```[\s\S]*?^```/gm, '');

  /** GitHub's anchor for each heading: lowercase, punctuation dropped, spaces as hyphens, `-1` on repeats. */
  function anchors(file: string): Set<string> {
    const seen = new Map<string, number>();
    const result = new Set<string>();
    for (const [, heading] of withoutCodeBlocks(read(file)).matchAll(/^#{1,6} (.+)$/gm)) {
      const slug = heading
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-');
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      result.add(count === 0 ? slug : `${slug}-${count}`);
    }
    return result;
  }

  for (const file of markdown) {
    it(`${file} links to files and headings that exist`, () => {
      const text = withoutCodeBlocks(read(file)).replace(/`[^`\n]*`/g, '');
      for (const [, link] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        let target: string;
        if (link.startsWith(`${REPO_URL}#`)) target = link.replace(REPO_URL, 'README.md');
        else if (link.startsWith(`${REPO_URL}/blob/main/`)) target = link.replace(`${REPO_URL}/blob/main/`, '');
        else if (/^[a-z]+:/.test(link)) continue;
        else target = link.startsWith('#') ? `${file}${link}` : path.join(path.dirname(file), link);
        const [targetFile, anchor] = target.split('#');
        assert.ok(existsSync(path.join(root, targetFile)), `${file}: ${link} (no such file)`);
        if (anchor && targetFile.endsWith('.md')) {
          assert.ok(anchors(targetFile).has(anchor), `${file}: ${link} (no such heading)`);
        }
      }
    });
  }

  it('names only npm scripts that exist', () => {
    for (const file of ['README.md', 'CONTRIBUTING.md', '.github/pull_request_template.md', ...ruleDocs]) {
      for (const [, script] of read(file).matchAll(/\bnpm run ([\w:-]+)/g)) {
        assert.ok(script in packageJson.scripts, `${file}: npm run ${script}`);
      }
    }
  });
});

describe('issue forms', () => {
  it('offer every rule in the wrong-report form', () => {
    const form = read('.github/ISSUE_TEMPLATE/1-false-report.yml');
    const options = /id: rule\n[\s\S]*?options:\n((?: +- .+\n)+)/.exec(form)?.[1] ?? '';
    const listed = [...options.matchAll(/- (\S+)/g)].map((m) => m[1]);
    assert.deepEqual(listed.sort(), Object.keys(testGovernance.rules).sort());
  });
});
