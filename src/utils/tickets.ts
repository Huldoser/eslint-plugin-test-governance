import { ConfigError } from './errors.ts';

export type TicketSpec =
  | { preset: 'any' }
  | { preset: 'jira'; projects?: string[]; host?: string }
  | { preset: 'github'; host?: string }
  | { preset: 'gitlab'; host?: string }
  | { preset: 'linear'; teams?: string[] }
  | { preset: 'azure-devops'; host?: string }
  | { preset: 'trello' }
  | { preset: 'notion'; prefixes?: string[]; host?: string }
  | { preset: 'asana' }
  | { preset: 'clickup'; prefixes?: string[] }
  | { preset: 'redmine'; host?: string }
  | { preset: 'monday'; prefixes?: string[] }
  | { preset: 'youtrack'; projects?: string[]; host?: string }
  | { preset: 'basecamp' }
  | { preset: 'shortcut' }
  | { preset: 'url'; hosts: string[] }
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

export const DEFAULT_PLACEHOLDERS = ['TODO', 'TBD', 'XXX-*', '0'];

// Every pattern below is anchored and has no nested or overlapping quantifiers, so matching is
// linear in the token length. URLs are parsed with `new URL` rather than a regex.
const KEY_RE = /^([A-Z][A-Z0-9_]+)-\d+$/;
const ISSUE_NUMBER_RE = /^#\d+$/;
const GITHUB_REF_RE = /^[A-Za-z0-9][A-Za-z0-9-]*\/[\w.-]+#\d+$/;
const GITLAB_REF_RE = /^[\w.-]+(?:\/[\w.-]+)+#\d+$/;
const AZURE_REF_RE = /^AB#\d+$/;
const DIGITS_RE = /^\d+$/;
// Jira Server and Data Center can run under a path, as in https://issues.example.com/jira/browse/TRADE-1.
const JIRA_PATH_RE = /\/browse\/([A-Z][A-Z0-9_]+-\d+)\/?$/;
const GITHUB_PATH_RE = /^\/[^/]+\/[^/]+\/(?:issues|pull)\/\d+\/?$/;
const GITLAB_PATH_RE = /\/-\/(?:issues|merge_requests|work_items)\/\d+\/?$/;
const LINEAR_PATH_RE = /^\/[^/]+\/issue\/([A-Z][A-Z0-9]*-\d+)(?:\/[^/]*)?$/;
const AZURE_PATH_RE = /\/_workitems\/edit\/\d+\/?$/;
const TRELLO_PATH_RE = /^\/c\/[A-Za-z0-9]{8}(?:\/[^/]*)?$/;
// A Notion page ID is 32 hex digits, plain or dashed as a UUID, at the end of the page's last path segment.
const NOTION_ID = '[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const NOTION_PAGE_RE = new RegExp(`(?:^|-)(?:${NOTION_ID})$`);
const NOTION_ID_RE = new RegExp(`^(?:${NOTION_ID})$`);
const ASANA_PATH_RE = /^\/(?:0\/\d+\/\d+(?:\/f)?|1\/\d+(?:\/project\/\d+|\/home)?\/task\/\d+(?:\/comment\/\d+)?)\/?$/;
const CLICKUP_ID_RE = /^[a-z0-9]+$/;
const CLICKUP_REF_RE = /^(?:CU-|#)[a-z0-9]+$/;
const CLICKUP_TASK_PATH_RE = /^\/t\/(?:\d+\/)?([^/]+)\/?$/;
const CLICKUP_VIEW_PATH_RE = /^\/\d+\/v\//;
const REDMINE_PATH_RE = /\/issues\/\d+(?:\.(?:json|xml|pdf|atom))?\/?$/;
const MONDAY_PATH_RE = /^\/boards\/\d+\/pulses\/\d+(?:\/.*)?$/;
// YouTrack project IDs may start with a digit (4DM-12) but can't be digits only.
const YOUTRACK_KEY_RE = /^([A-Z0-9_]+)-\d+$/;
const YOUTRACK_PATH_RE = /\/issue\/([A-Z0-9_]+-\d+)(?:\/[^/]*)?$/;
const BASECAMP_PATH_RE = /^\/\d+\/buckets\/\d+\/(?:todos|card_tables\/cards)\/\d+\/?$/;
const SHORTCUT_REF_RE = /^(?:sc-[1-9]\d*|\[sc-[1-9]\d*\])$/i;
const SHORTCUT_PATH_RE = /^\/[^/]+\/story\/\d+(?:\/[^/]*)?$/;
// No tracker issues number 0, so PROJ-0, #0, AB#0, [sc-0], .../issues/0 and 000 are always placeholders.
const ZERO_ID_RE = /(?:^|[-#/])0+[/\]]?$/;

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

/** `*.example.com` matches the subdomains of example.com; any other entry matches its host exactly. */
function hostInList(url: URL, hosts: string[]): boolean {
  const hostname = url.hostname.toLowerCase();
  return hosts.some((host) => {
    const lower = host.toLowerCase();
    return lower.startsWith('*.') ? hostname.endsWith(lower.slice(1)) : hostname === lower;
  });
}

function isYouTrackKey(key: string, projects: string[] | undefined): boolean {
  const project = YOUTRACK_KEY_RE.exec(key)?.[1];
  return project !== undefined && /[A-Z]/.test(project) && inList(project, projects);
}

function inList(value: string, list: string[] | undefined): boolean {
  return list === undefined || list.includes(value);
}

function keyInList(key: string, list: string[] | undefined): boolean {
  return inList(key.slice(0, key.lastIndexOf('-')), list);
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
      const keyOk = (key: string): boolean => keyInList(key, projects);
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
      const keyOk = (key: string): boolean => keyInList(key, teams);
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
          if (AZURE_REF_RE.test(t) || ISSUE_NUMBER_RE.test(t)) return true;
          const url = parseUrl(t);
          if (!url) return false;
          const hostOk =
            host === undefined
              ? hostMatches(url, 'dev.azure.com') || url.hostname.toLowerCase().endsWith('.visualstudio.com')
              : hostMatches(url, host);
          return hostOk && AZURE_PATH_RE.test(url.pathname);
        },
        expected: 'an Azure Boards work item like AB#4821 or #4821, or a work item URL',
        example: 'AB#4821',
      };
    }
    case 'trello':
      return {
        test: (t) => {
          const url = parseUrl(t);
          return url !== undefined && hostMatches(url, 'trello.com') && TRELLO_PATH_RE.test(url.pathname);
        },
        expected: 'a Trello card link like https://trello.com/c/nqPiDKmw',
        example: 'https://trello.com/c/nqPiDKmw',
      };
    case 'notion': {
      const { prefixes, host } = spec;
      const hosts = host === undefined ? ['notion.so', 'www.notion.so', '*.notion.site'] : [host];
      return {
        test: (t) => {
          if (KEY_RE.test(t)) return keyInList(t, prefixes);
          const url = parseUrl(t);
          if (!url || !hostInList(url, hosts)) return false;
          const peek = url.searchParams.get('p');
          if (peek !== null) return NOTION_ID_RE.test(peek);
          if (url.searchParams.has('v')) return false;
          const segment = /^\/(?:[^/]+\/)?([^/]+)$/.exec(url.pathname)?.[1];
          if (segment === undefined) return false;
          return KEY_RE.test(segment) ? keyInList(segment, prefixes) : NOTION_PAGE_RE.test(segment);
        },
        expected: `a Notion ID like ${prefixes?.[0] ?? 'TASK'}-123${describeList('prefix', prefixes)}, or a Notion page link`,
        example: `${prefixes?.[0] ?? 'TASK'}-123`,
      };
    }
    case 'asana':
      return {
        test: (t) => {
          const url = parseUrl(t);
          return url !== undefined && hostMatches(url, 'app.asana.com') && ASANA_PATH_RE.test(url.pathname);
        },
        expected: 'an Asana task link like https://app.asana.com/0/0/1204821736251904',
        example: 'https://app.asana.com/0/0/1204821736251904',
      };
    case 'clickup': {
      const { prefixes } = spec;
      const idOk = (id: string): boolean => CLICKUP_ID_RE.test(id) || (KEY_RE.test(id) && keyInList(id, prefixes));
      return {
        test: (t) => {
          if (CLICKUP_REF_RE.test(t)) return true;
          if (KEY_RE.test(t)) return keyInList(t, prefixes);
          const url = parseUrl(t);
          if (!url || !hostMatches(url, 'app.clickup.com')) return false;
          if (CLICKUP_VIEW_PATH_RE.test(url.pathname)) return CLICKUP_ID_RE.test(url.searchParams.get('p') ?? '');
          const id = CLICKUP_TASK_PATH_RE.exec(url.pathname)?.[1];
          return id !== undefined && idOk(id);
        },
        expected: `a ClickUp task like CU-86abc123 or ${prefixes?.[0] ?? 'DEV'}-123${describeList('prefix', prefixes)}, or a ClickUp task link`,
        example: prefixes === undefined ? 'CU-86abc123' : `${prefixes[0]}-123`,
      };
    }
    case 'redmine': {
      const { host } = spec;
      return {
        test: (t) => {
          if (ISSUE_NUMBER_RE.test(t)) return true;
          const url = parseUrl(t);
          return (
            url !== undefined && host !== undefined && hostMatches(url, host) && REDMINE_PATH_RE.test(url.pathname)
          );
        },
        expected:
          host === undefined
            ? 'a Redmine issue like #4821 (set host to accept issue links)'
            : `a Redmine issue like #4821, or an issue URL on ${host}`,
        example: '#4821',
      };
    }
    case 'monday': {
      const { prefixes } = spec;
      return {
        test: (t) => {
          if (KEY_RE.test(t)) return keyInList(t, prefixes);
          const url = parseUrl(t);
          return url !== undefined && hostInList(url, ['*.monday.com']) && MONDAY_PATH_RE.test(url.pathname);
        },
        expected: `a monday.com item link like https://acme.monday.com/boards/1234567890/pulses/1234567891, or a custom key like ${prefixes?.[0] ?? 'TIX'}-001${describeList('prefix', prefixes)}`,
        example: 'https://acme.monday.com/boards/1234567890/pulses/1234567891',
      };
    }
    case 'youtrack': {
      const { projects, host } = spec;
      const hosts = host === undefined ? ['youtrack.jetbrains.com', '*.youtrack.cloud', '*.myjetbrains.com'] : [host];
      return {
        test: (t) => {
          if (YOUTRACK_KEY_RE.test(t)) return isYouTrackKey(t, projects);
          const url = parseUrl(t);
          if (!url || !hostInList(url, hosts)) return false;
          const key = YOUTRACK_PATH_RE.exec(url.pathname)?.[1];
          return key !== undefined && isYouTrackKey(key, projects);
        },
        expected: `a YouTrack issue like ${projects?.[0] ?? 'PROJ'}-123${describeList('project', projects)}, or a YouTrack issue link`,
        example: `${projects?.[0] ?? 'PROJ'}-123`,
      };
    }
    case 'basecamp':
      return {
        test: (t) => {
          const url = parseUrl(t);
          return url !== undefined && hostMatches(url, '3.basecamp.com') && BASECAMP_PATH_RE.test(url.pathname);
        },
        expected: 'a Basecamp to-do or card link like https://3.basecamp.com/4821/buckets/4822/todos/4823',
        example: 'https://3.basecamp.com/4821/buckets/4822/todos/4823',
      };
    case 'shortcut':
      return {
        test: (t) => {
          if (SHORTCUT_REF_RE.test(t)) return true;
          const url = parseUrl(t);
          return (
            url !== undefined &&
            hostInList(url, ['app.shortcut.com', 'app.clubhouse.io']) &&
            SHORTCUT_PATH_RE.test(url.pathname)
          );
        },
        expected: 'a Shortcut story like sc-123, or a story link',
        example: 'sc-123',
      };
    case 'url': {
      // The schema can't tie `hosts` to this preset, so check it here.
      const { hosts } = spec as { hosts?: string[] };
      if (hosts === undefined) {
        throw new ConfigError('the "url" ticket preset needs `hosts`, the hosts its links may point to.');
      }
      return {
        test: (t) => {
          const url = parseUrl(t);
          return url !== undefined && hostInList(url, hosts);
        },
        expected: `a link to ${hosts.join(', ')}`,
        example: `https://${hosts[0].replace(/^\*\./, 'tasks.')}/4821`,
      };
    }
    case 'numeric': {
      const min = spec.minLength ?? 1;
      const max = spec.maxLength ?? 20;
      if (min > max) {
        throw new ConfigError(`numeric ticket minLength (${min}) is greater than maxLength (${max}).`);
      }
      return {
        test: (t) => DIGITS_RE.test(t) && t.length >= min && t.length <= max,
        expected: min === max ? `a ${min}-digit number` : `a number with ${min} to ${max} digits`,
        example: '482173'.repeat(4).slice(0, Math.min(Math.max(4, min), max)),
      };
    }
    case 'pattern': {
      // The schema can't tie `pattern` to this preset, so check it here.
      if ((spec as { pattern?: unknown }).pattern === undefined) {
        throw new ConfigError('the "pattern" ticket preset needs a `pattern` regex string.');
      }
      let re: RegExp;
      try {
        // `g` and `y` make `test()` resume from the last match, so the same ticket would pass and fail
        // in turn. A ticket is matched whole, so they never change what matches; drop them.
        re = new RegExp(`^(?:${spec.pattern})$`, spec.flags?.replace(/[gy]/g, ''));
      } catch (error) {
        throw new ConfigError(`invalid ticket pattern "${spec.pattern}": ${(error as Error).message}`);
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
