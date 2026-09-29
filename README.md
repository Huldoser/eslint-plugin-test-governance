# eslint-plugin-test-governance

An ESLint plugin that keeps Playwright test suites honest: it requires a ticket comment directly above any skipped, `fixme`, `@new` or `@unstable` test, so every disabled or quarantined test is traceable to a tracked piece of work. For example, `// SKIP: PROJ-123` must appear above `test.skip(...)`, otherwise the rule reports an error.
