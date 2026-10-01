export type TicketSpec =
  | { preset: 'any' }
  | { preset: 'jira'; projects?: string[]; host?: string }
  | { preset: 'github'; host?: string }
  | { preset: 'gitlab'; host?: string }
  | { preset: 'linear'; teams?: string[] }
  | { preset: 'azure-devops'; host?: string }
  | { preset: 'numeric'; minLength?: number; maxLength?: number }
  | { preset: 'pattern'; pattern: string; flags?: string };

export type TicketCheck = 'ok' | 'placeholder' | 'format';

export interface TicketMatcher {
  check(ticket: string): TicketCheck;
  /** Human-readable description of the accepted formats, used in messages. */
  expected: string;
  /** A sample ticket for messages. */
  example: string;
}

export const DEFAULT_PLACEHOLDERS = ['TODO', 'TBD', 'XXX-*', '0', '123', '1234', '12345'];

// Every pattern below is anchored and has no nested or overlapping quantifiers, so matching is
// linear in the token length. URLs are parsed with `new URL` rather than a regex.
const KEY_RE = /^([A-Z][A-Z0-9_]+)-\d+$/;
const ISSUE_NUMBER_RE = /^#\d+$/;
const GITHUB_REF_RE = /^[A-Za-z0-9][A-Za-z0-9-]*\/[\w.-]+#\d+$/;
const GITLAB_REF_RE = /^[\w.-]+(?:\/[\w.-]+)+#\d+$/;
const AZURE_REF_RE = /^AB#\d+$/;
const DIGITS_RE = /^\d+$/;
const JIRA_PATH_RE = /^\/browse\/([A-Z][A-Z0-9_]+-\d+)\/?$/;
const GITHUB_PATH_RE = /^\/[^/]+\/[^/]+\/(?:issues|pull)\/\d+\/?$/;
const GITLAB_PATH_RE = /\/-\/(?:issues|merge_requests|work_items)\/\d+\/?$/;
const LINEAR_PATH_RE = /^\/[^/]+\/issue\/([A-Z][A-Z0-9]*-\d+)(?:\/[^/]*)?$/;
const AZURE_PATH_RE = /\/_workitems\/edit\/\d+\/?$/;
// No tracker issues number 0, so PROJ-0, #0, AB#0, .../issues/0 and 000 are always placeholders.
const ZERO_ID_RE = /(?:^|[-#/])0+\/?$/;

type Predicate = (ticket: string) => boolean;

interface CompiledPreset {
  test: Predicate;
  expected: string;
  example: string;
}

function parseUrl(ticket: string): URL | undefined {
  if (!/^https?:\/\//.test(ticket)) return undefined;
  try {
    return new URL(ticket);
  } catch {
    return undefined;
  }
}

function hostMatches(url: URL, host: string): boolean {
  return url.hostname.toLowerCase() === host.toLowerCase();
}

function inList(value: string, list: string[] | undefined): boolean {
  return list === undefined || list.includes(value);
}

function describeList(noun: string, list: string[] | undefined): string {
  return list === undefined ? '' : ` in ${noun} ${list.join(', ')}`;
}

function compilePreset(spec: TicketSpec): CompiledPreset {
  switch (spec.preset) {
    case 'any':
      return {
        test: (t) => KEY_RE.test(t) || ISSUE_NUMBER_RE.test(t) || GITLAB_REF_RE.test(t) || parseUrl(t) !== undefined,
        expected: 'a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL',
        example: 'PROJ-123',
      };
    case 'jira': {
      const { projects, host } = spec;
      const keyOk = (key: string): boolean => inList(key.slice(0, key.lastIndexOf('-')), projects);
      return {
        test: (t) => {
          if (KEY_RE.test(t)) return keyOk(t);
          const url = parseUrl(t);
          if (!url || (host !== undefined && !hostMatches(url, host))) return false;
          const key = JIRA_PATH_RE.exec(url.pathname)?.[1] ?? url.searchParams.get('selectedIssue');
          return key !== null && KEY_RE.test(key) && keyOk(key);
        },
        expected: `a Jira key like ${projects?.[0] ?? 'PROJ'}-123${describeList('project', projects)}, or a Jira URL`,
        example: `${projects?.[0] ?? 'PROJ'}-123`,
      };
    }
    case 'github': {
      const host = spec.host ?? 'github.com';
      return {
        test: (t) => {
          if (ISSUE_NUMBER_RE.test(t) || GITHUB_REF_RE.test(t)) return true;
          const url = parseUrl(t);
          return url !== undefined && hostMatches(url, host) && GITHUB_PATH_RE.test(url.pathname);
        },
        expected: `a GitHub issue like #4821 or owner/repo#4821, or an issue URL on ${host}`,
        example: '#4821',
      };
    }
    case 'gitlab': {
      const host = spec.host ?? 'gitlab.com';
      return {
        test: (t) => {
          if (ISSUE_NUMBER_RE.test(t) || GITLAB_REF_RE.test(t)) return true;
          const url = parseUrl(t);
          return url !== undefined && hostMatches(url, host) && GITLAB_PATH_RE.test(url.pathname);
        },
        expected: `a GitLab issue like #4821 or group/project#4821, or an issue URL on ${host}`,
        example: '#4821',
      };
    }
    case 'linear': {
      const { teams } = spec;
      const keyOk = (key: string): boolean => inList(key.slice(0, key.lastIndexOf('-')), teams);
      return {
        test: (t) => {
          if (KEY_RE.test(t)) return keyOk(t);
          const url = parseUrl(t);
          if (!url || !hostMatches(url, 'linear.app')) return false;
          const key = LINEAR_PATH_RE.exec(url.pathname)?.[1];
          return key !== undefined && keyOk(key);
        },
        expected: `a Linear issue like ${teams?.[0] ?? 'ENG'}-123${describeList('team', teams)}, or a Linear URL`,
        example: `${teams?.[0] ?? 'ENG'}-123`,
      };
    }
    case 'azure-devops': {
      const { host } = spec;
      return {
        test: (t) => {
          if (AZURE_REF_RE.test(t)) return true;
          const url = parseUrl(t);
          if (!url) return false;
          const hostOk =
            host === undefined
              ? hostMatches(url, 'dev.azure.com') || url.hostname.toLowerCase().endsWith('.visualstudio.com')
              : hostMatches(url, host);
          return hostOk && AZURE_PATH_RE.test(url.pathname);
        },
        expected: 'an Azure Boards work item like AB#4821, or a work item URL',
        example: 'AB#4821',
      };
    }
    case 'numeric': {
      const min = spec.minLength ?? 1;
      const max = spec.maxLength ?? 20;
      return {
        test: (t) => DIGITS_RE.test(t) && t.length >= min && t.length <= max,
        expected: min === max ? `a ${min}-digit number` : `a number with ${min} to ${max} digits`,
        example: '482173'.repeat(4).slice(0, Math.min(Math.max(4, min), max)),
      };
    }
    case 'pattern': {
      let re: RegExp;
      try {
        re = new RegExp(`^(?:${spec.pattern})$`, spec.flags);
      } catch (error) {
        throw new Error(
          `eslint-plugin-test-governance: invalid ticket pattern "${spec.pattern}": ${(error as Error).message}`,
        );
      }
      return { test: (t) => re.test(t), expected: `a ticket matching /${spec.pattern}/`, example: 'TICKET' };
    }
  }
}

function globToRegExp(glob: string): RegExp {
  const body = glob
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}$`, 'i');
}

export function compileTicketSpec(specs: TicketSpec[], placeholders: string[]): TicketMatcher {
  const presets = specs.map(compilePreset);
  const placeholderRes = placeholders.map(globToRegExp);
  return {
    check(ticket) {
      const bare = ticket.replace(/^#/, '');
      if (ZERO_ID_RE.test(ticket) || placeholderRes.some((re) => re.test(ticket) || re.test(bare)))
        return 'placeholder';
      return presets.some((preset) => preset.test(ticket)) ? 'ok' : 'format';
    },
    expected: presets.map((p) => p.expected).join('; or '),
    example: presets[0].example,
  };
}
