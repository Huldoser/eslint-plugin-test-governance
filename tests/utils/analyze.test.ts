import assert from 'node:assert/strict';
import { it } from 'node:test';
import { Linter } from 'eslint';
import { analyze } from '../../src/utils/analyze.ts';
import { resolveOptions } from '../../src/utils/options.ts';

it('analyzes a file once for all the rules that share its options', () => {
  const linter = new Linter();
  linter.verify("test.skip('places an order', async () => {});", {});
  // The rules get the same object, typed as typescript-eslint's SourceCode.
  const sourceCode = linter.getSourceCode() as unknown as Parameters<typeof analyze>[0];
  const playwright = resolveOptions({ 'test-governance': { framework: 'playwright' } });
  const jest = resolveOptions({ 'test-governance': { framework: 'jest' } });
  assert.equal(analyze(sourceCode, playwright), analyze(sourceCode, playwright));
  assert.notEqual(analyze(sourceCode, jest), analyze(sourceCode, playwright));
});
