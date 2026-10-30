/** Marker keywords: uppercase letters, digits, `-` and `_`, starting with a letter. */
export const MARKER_RE = /^[A-Z][A-Z0-9_-]*$/;
/** A tag as written in options: `@` followed by letters, digits, `-` and `_`. */
export const TAG_RE = /^@[\w-]+$/;
/** One label of a host name: letters and digits, with hyphens only between them. */
const HOST_LABEL = '[A-Za-z0-9]+(?:-+[A-Za-z0-9]+)*';
/** A host name with no scheme, port or path, such as `tracker.example.com`. */
export const HOST_NAME_RE = new RegExp(`^${HOST_LABEL}(?:\\.${HOST_LABEL})*$`);
/** A `url` preset host: a host name, or `*.` and a domain of two or more labels for its subdomains. */
export const HOST_ENTRY_RE = new RegExp(
  `^(?:${HOST_LABEL}(?:\\.${HOST_LABEL})*|\\*\\.${HOST_LABEL}(?:\\.${HOST_LABEL})+)$`,
);

export const BUILTIN_STATE_NAMES = ['skip', 'fixme', 'fail', 'slow', 'todo', 'new', 'quarantined'] as const;
export type BuiltinStateName = (typeof BUILTIN_STATE_NAMES)[number];
/** The built-in states a tag puts a test in, so the only ones whose tag can be renamed. */
export const TAG_STATE_NAMES = ['new', 'quarantined'] as const satisfies readonly BuiltinStateName[];
export type TagStateName = (typeof TAG_STATE_NAMES)[number];

/** The test frameworks the rules understand. */
export const FRAMEWORK_NAMES = [
  'playwright',
  'jest',
  'vitest',
  'mocha',
  'cypress',
  'webdriverio',
  'node-test',
  'jasmine',
] as const;
export type FrameworkName = (typeof FRAMEWORK_NAMES)[number];

export const TICKET_PRESETS = [
  'any',
  'jira',
  'github',
  'gitlab',
  'linear',
  'azure-devops',
  'trello',
  'notion',
  'asana',
  'clickup',
  'redmine',
  'monday',
  'youtrack',
  'basecamp',
  'shortcut',
  'url',
  'numeric',
  'pattern',
] as const;

/** Comment keywords that must reference a ticket by default (`// TODO: TRADE-123`). */
export const DEFAULT_COMMENT_KEYWORDS = ['FIXME', 'TODO'];
