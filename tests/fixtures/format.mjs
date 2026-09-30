import path from 'node:path';

/** Formats ESLint results as stable text so the snapshot reads like CLI output. */
export function formatResults(results, cwd) {
  const lines = [];
  for (const result of [...results].sort((a, b) => a.filePath.localeCompare(b.filePath))) {
    const file = path.relative(cwd, result.filePath).split(path.sep).join('/');
    for (const m of result.messages) {
      const severity = m.severity === 2 ? 'error' : 'warn ';
      lines.push(`${file}:${m.line}:${m.column} ${severity} ${m.ruleId} ${m.message}`);
    }
  }
  return lines.join('\n') + '\n';
}
