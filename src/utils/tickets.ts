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
  | { preset: 'openproject'; host?: string }
  | { preset: 'bugzilla'; host?: string }
  | { preset: 'phabricator'; host?: string }
  | { preset: 'rally' }
  | { preset: 'servicenow'; prefixes: string[] }
  | { preset: 'plane'; projects?: string[]; host?: string }
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
const GITHUB_PATH_RE = /^\/[^/]+\/[^/]+\/(?:issues|pull)\/(\d+)\/?$/;
const GITLAB_PATH_RE = /\/-\/(?:issues|merge_requests|work_items)\/(\d+)\/?$/;
const LINEAR_PATH_RE = /^\/[^/]+\/issue\/([A-Z][A-Z0-9]*-\d+)(?:\/[^/]*)?$/;
const AZURE_PATH_RE = /\/_workitems\/edit\/(\d+)\/?$/;
const TRELLO_PATH_RE = /^\/c\/([A-Za-z0-9]{8})(?:\/[^/]*)?$/;
// A Notion page ID is 32 hex digits, plain or dashed as a UUID, at the end of the page's last path segment.
const NOTION_ID = '[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const NOTION_PAGE_RE = new RegExp(`(?:^|-)(${NOTION_ID})$`);
const NOTION_ID_RE = new RegExp(`^(?:${NOTION_ID})$`);
const ASANA_PATH_RE =
  /^\/(?:0\/\d+\/(\d+)(?:\/f)?|1\/\d+(?:\/project\/\d+|\/home)?\/task\/(\d+)(?:\/comment\/\d+)?)\/?$/;
// ClickUp task IDs are lowercase letters and digits, with at least one digit.
const CLICKUP_ID_RE = /^(?=[a-z]*\d)[a-z0-9]+$/;
const CLICKUP_REF_RE = /^(?:CU-|#)([a-z0-9]+)$/;
const CLICKUP_TASK_PATH_RE = /^\/t\/(?:\d+\/)?([^/]+)\/?$/;
const CLICKUP_VIEW_PATH_RE = /^\/\d+\/v\//;
// `#123`, a note of it (`#123-4`, `#123#note-4`), and `##123`, which Redmine shows with its subject.
const REDMINE_REF_RE = /^##?(\d+)(?:-\d+|#note-\d+)?$/;
const REDMINE_PATH_RE = /\/issues\/(\d+)(?:\.(?:json|xml|pdf|atom))?\/?$/;
const MONDAY_PATH_RE = /^\/boards\/\d+\/pulses\/(\d+)(?:\/.*)?$/;
// YouTrack project IDs may start with a digit (4DM-12) but can't be digits only.
const YOUTRACK_KEY_RE = /^([A-Z0-9_]+)-\d+$/;
// `/issue/KT-1` and the newer `/projects/KT/issues/KT-1`, with an optional title after the key.
const YOUTRACK_PATH_RE = /\/(?:issue|projects\/[^/]+\/issues)\/([A-Z0-9_]+-\d+)(?:\/[^/]*)?$/;
const BASECAMP_PATH_RE = /^\/\d+\/buckets\/\d+\/(?:todos|card_tables\/cards)\/(\d+)\/?$/;
const SHORTCUT_REF_RE = /^(?:sc-(\d+)|\[sc-(\d+)\])$/i;
const SHORTCUT_PATH_RE = /^\/[^/]+\/story\/(\d+)(?:\/[^/]*)?$/;
// OpenProject work packages: the canonical `/projects/<identifier>/work_packages/<id or AGILE-1>` with any
// tab path after it, and the `/wp/<id>` short form its changelog links use.
const OPENPROJECT_PATH_RE = /\/projects\/[^/]+\/work_packages\/([A-Z][A-Z0-9_]+-\d+|\d+)(?:\/.*)?\/?$/;
const OPENPROJECT_SHORT_RE = /^\/(?:work_packages|wp)\/(\d+)(?:\/.*)?\/?$/;
// Bugzilla runs under any path, as `/bugzilla/show_bug.cgi`; the bug is in the `id` query value.
const BUGZILLA_CGI_RE = /\/show_bug\.cgi\/?$/;
// Phabricator tasks: the `T4821` monogram, and the `/T4821` path its instances use.
const PHABRICATOR_REF_RE = /^T(\d+)$/;
const PHABRICATOR_PATH_RE = /^\/T(\d+)\/?$/;
// Rally's Formatted IDs: a user story, defect, task or test case.
// Rally numbers its work items per workspace from 1 without padding (US42, US41048), so a zero-padded ID is
// no Rally ticket: it is how MITRE ATT&CK writes its technique IDs (TA0001 to TA0043), which security suites
// put above tests. An all-zero ID such as TA0000 is a placeholder, as in every preset.
const RALLY_REF_RE = /^(?:US|DE|TA|TC)([1-9]\d*|0*)$/;
// Plane work items: `/<workspace>/<project>/issues/<WEB-142 or uuid>`, unanchored for a self-hosted path.
const PLANE_PATH_RE =
  /\/[^/]+\/[^/]+\/issues\/([A-Z][A-Z0-9_]+-\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/;
// No tracker issues number 0. A preset hands back the ID it finds, and an ID of zeros (0, 000, or a
// Notion page ID of zeros) makes the ticket a placeholder. A ticket no preset reads is a placeholder
// when it ends in a zero ID, as PROJ-0, #0, AB#0 or .../issues/0 do.
const ZERO_RE = /^(?:0+|0{8}-0{4}-0{4}-0{4}-0{12})$/;
const ZERO_ID_RE = /(?:^|[-#/])0+[/\]]?$/;
// The number at the end of a link to an unknown tracker, as in `/issues/123`.
const LINK_NUMBER_RE = /\/(\d+)\/?$/;

/** The ID a preset finds in a ticket, or undefined when the ticket isn't one of its forms. */
type Finder = (ticket: string) => string | undefined;

interface CompiledPreset {
  find: Finder;
  /** `any`, `url` and `pattern` read tickets of any tracker, so a tracker's own preset decides first. */
  generic?: true;
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

/** The link's host name in lowercase, without the trailing dot that `trello.com.` may have. */
function hostnameOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.$/, '');
}

/** `*.example.com` matches the subdomains of example.com; any other host matches exactly. */
function hostMatches(url: URL, host: string): boolean {
  const hostname = hostnameOf(url);
  const lower = host.toLowerCase().replace(/\.$/, '');
  return lower.startsWith('*.') ? hostname.endsWith(lower.slice(1)) : hostname === lower;
}

function hostInList(url: URL, hosts: string[]): boolean {
  return hosts.some((host) => hostMatches(url, host));
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

/** `TRADE-1` for `TRADE-1/`, as a query value copied with the link's trailing slash reads. */
function trimSlash(value: string): string {
  return value.replace(/\/$/, '');
}

/** The number in `TRADE-123`, `#123`, `owner/repo#123` or `AB#123`. */
function numberOf(ticket: string): string {
  return ticket.slice(Math.max(ticket.lastIndexOf('-'), ticket.lastIndexOf('#')) + 1);
}

/** `TRADE-123`'s number, when the key passes `ok`. */
function keyId(key: string | null | undefined, ok: (key: string) => boolean): string | undefined {
  return key !== null && key !== undefined && ok(key) ? numberOf(key) : undefined;
}

/**
 * A link's ID when the preset doesn't know the tracker: the keys in its path, `#/route` or query (Jira's
 * `?selectedIssue=TRADE-1`) and the number its path or route ends in. A zero among them makes the link a
 * placeholder, as in 0.9.0; with none, the link itself stands for the ID.
 */
function linkId(url: URL): string {
  const route = /^#!?\//.test(url.hash) ? url.hash.replace(/^#!?/, '') : '';
  const parts = [...url.pathname.split('/'), ...route.split('/'), ...[...url.searchParams.values()].map(trimSlash)];
  const keys = parts.filter((part) => KEY_RE.test(part));
  const ends = [url.pathname, route].flatMap((path) => LINK_NUMBER_RE.exec(path)?.[1] ?? []);
  const numbers = [...keys, ...ends].map(numberOf);
  return numbers.find((id) => ZERO_RE.test(id)) ?? numbers.at(0) ?? url.href;
}

/** `TRADE, RISK or OPS` for `['TRADE', 'RISK', 'OPS']`. */
function orList(list: string[]): string {
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

/** ` in project TRADE or RISK` for `describeList('in project', ['TRADE', 'RISK'])`. */
function describeList(words: string, list: string[] | undefined): string {
  return list === undefined ? '' : ` ${words} ${orList(list)}`;
}

function compilePreset(spec: TicketSpec): CompiledPreset {
  switch (spec.preset) {
    case 'any':
      return {
        find: (t) => {
          if (KEY_RE.test(t) || ISSUE_NUMBER_RE.test(t) || GITLAB_REF_RE.test(t)) return numberOf(t);
          const url = parseUrl(t);
          return url && linkId(url);
        },
        expected: 'a ticket key like PROJ-123, an issue like #4821 or owner/repo#4821, or a URL',
        example: 'PROJ-123',
        generic: true,
      };
    case 'jira': {
      const { projects, host } = spec;
      const keyOk = (key: string): boolean => KEY_RE.test(key) && keyInList(key, projects);
      return {
        find: (t) => {
          if (KEY_RE.test(t)) return keyId(t, keyOk);
          const url = parseUrl(t);
          if (!url || (host !== undefined && !hostMatches(url, host))) return undefined;
          const selected = url.searchParams.get('selectedIssue');
          return keyId(JIRA_PATH_RE.exec(url.pathname)?.[1] ?? (selected === null ? null : trimSlash(selected)), keyOk);
        },
        expected: `a Jira key like ${projects?.[0] ?? 'PROJ'}-123${describeList('in project', projects)}, or a Jira URL${host === undefined ? '' : ` on ${host}`}`,
        example: `${projects?.[0] ?? 'PROJ'}-123`,
      };
    }
    case 'github': {
      const host = spec.host ?? 'github.com';
      return {
        find: (t) => {
          if (ISSUE_NUMBER_RE.test(t) || GITHUB_REF_RE.test(t)) return numberOf(t);
          const url = parseUrl(t);
          return url && hostMatches(url, host) ? GITHUB_PATH_RE.exec(url.pathname)?.[1] : undefined;
        },
        expected: `a GitHub issue like #4821 or owner/repo#4821, or an issue URL on ${host}`,
        example: '#4821',
      };
    }
    case 'gitlab': {
      const host = spec.host ?? 'gitlab.com';
      return {
        find: (t) => {
          if (ISSUE_NUMBER_RE.test(t) || GITLAB_REF_RE.test(t)) return numberOf(t);
          const url = parseUrl(t);
          return url && hostMatches(url, host) ? GITLAB_PATH_RE.exec(url.pathname)?.[1] : undefined;
        },
        expected: `a GitLab issue like #4821 or group/project#4821, or an issue URL on ${host}`,
        example: '#4821',
      };
    }
    case 'linear': {
      const { teams } = spec;
      const keyOk = (key: string): boolean => keyInList(key, teams);
      return {
        find: (t) => {
          if (KEY_RE.test(t)) return keyId(t, keyOk);
          const url = parseUrl(t);
          return url && hostMatches(url, 'linear.app')
            ? keyId(LINEAR_PATH_RE.exec(url.pathname)?.[1], keyOk)
            : undefined;
        },
        expected: `a Linear issue like ${teams?.[0] ?? 'ENG'}-123${describeList('in team', teams)}, or a Linear URL`,
        example: `${teams?.[0] ?? 'ENG'}-123`,
      };
    }
    case 'azure-devops': {
      const { host } = spec;
      return {
        find: (t) => {
          if (AZURE_REF_RE.test(t) || ISSUE_NUMBER_RE.test(t)) return numberOf(t);
          const url = parseUrl(t);
          if (!url) return undefined;
          const hostOk =
            host === undefined
              ? hostMatches(url, 'dev.azure.com') || hostnameOf(url).endsWith('.visualstudio.com')
              : hostMatches(url, host);
          return hostOk ? AZURE_PATH_RE.exec(url.pathname)?.[1] : undefined;
        },
        expected: `an Azure Boards work item like AB#4821 or #4821, or a work item URL${host === undefined ? '' : ` on ${host}`}`,
        example: 'AB#4821',
      };
    }
    case 'trello':
      return {
        find: (t) => {
          const url = parseUrl(t);
          return url && hostMatches(url, 'trello.com') ? TRELLO_PATH_RE.exec(url.pathname)?.[1] : undefined;
        },
        expected: 'a Trello card link like https://trello.com/c/nqPiDKmw',
        example: 'https://trello.com/c/nqPiDKmw',
      };
    case 'notion': {
      const { prefixes, host } = spec;
      const hosts = host === undefined ? ['notion.so', 'www.notion.so', 'app.notion.com', '*.notion.site'] : [host];
      const keyOk = (key: string): boolean => keyInList(key, prefixes);
      return {
        find: (t) => {
          if (KEY_RE.test(t)) return keyId(t, keyOk);
          const url = parseUrl(t);
          if (!url || !hostInList(url, hosts)) return undefined;
          const peek = url.searchParams.get('p');
          if (peek !== null) return NOTION_ID_RE.test(peek) ? peek : undefined;
          if (url.searchParams.has('v')) return undefined;
          const segment = /^\/(?:[^/]+\/)?([^/]+)$/.exec(url.pathname)?.[1];
          if (segment === undefined) return undefined;
          return KEY_RE.test(segment) ? keyId(segment, keyOk) : NOTION_PAGE_RE.exec(segment)?.[1];
        },
        expected: `a Notion ID like ${prefixes?.[0] ?? 'TASK'}-123${describeList('with prefix', prefixes)}, or a Notion page link${host === undefined ? '' : ` on ${host}`}`,
        example: `${prefixes?.[0] ?? 'TASK'}-123`,
      };
    }
    case 'asana':
      return {
        find: (t) => {
          const url = parseUrl(t);
          const match = url && hostMatches(url, 'app.asana.com') ? ASANA_PATH_RE.exec(url.pathname) : undefined;
          // The task ID is in the first group for the /0/ layout and the second for /1/.
          return match?.slice(1).find(Boolean);
        },
        expected: 'an Asana task link like https://app.asana.com/0/0/1204821736251904',
        example: 'https://app.asana.com/0/0/1204821736251904',
      };
    case 'clickup': {
      const { prefixes } = spec;
      const keyOk = (key: string): boolean => KEY_RE.test(key) && keyInList(key, prefixes);
      const taskId = (id: string | null | undefined): string | undefined =>
        id !== null && id !== undefined && CLICKUP_ID_RE.test(id) ? id : keyId(id, keyOk);
      return {
        find: (t) => {
          const ref = CLICKUP_REF_RE.exec(t)?.[1];
          if (ref !== undefined) return taskId(ref);
          if (KEY_RE.test(t)) return keyId(t, keyOk);
          const url = parseUrl(t);
          if (!url || !hostMatches(url, 'app.clickup.com')) return undefined;
          if (CLICKUP_VIEW_PATH_RE.test(url.pathname)) {
            const peek = url.searchParams.get('p');
            return peek !== null && CLICKUP_ID_RE.test(peek) ? peek : undefined;
          }
          return taskId(CLICKUP_TASK_PATH_RE.exec(url.pathname)?.[1]);
        },
        expected: `a ClickUp task like CU-86abc123 or ${prefixes?.[0] ?? 'DEV'}-123${describeList('with prefix', prefixes)}, or a ClickUp task link`,
        example: prefixes === undefined ? 'CU-86abc123' : `${prefixes[0]}-123`,
      };
    }
    case 'redmine': {
      const { host } = spec;
      return {
        find: (t) => {
          const ref = REDMINE_REF_RE.exec(t)?.[1];
          if (ref !== undefined) return ref;
          const url = parseUrl(t);
          return url && host !== undefined && hostMatches(url, host)
            ? REDMINE_PATH_RE.exec(url.pathname)?.[1]
            : undefined;
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
      const keyOk = (key: string): boolean => keyInList(key, prefixes);
      return {
        find: (t) => {
          if (KEY_RE.test(t)) return keyId(t, keyOk);
          const url = parseUrl(t);
          return url && hostInList(url, ['*.monday.com']) ? MONDAY_PATH_RE.exec(url.pathname)?.[1] : undefined;
        },
        expected: `a monday.com item link like https://acme.monday.com/boards/1234567890/pulses/1234567891, or a custom key like ${prefixes?.[0] ?? 'TIX'}-001${describeList('with prefix', prefixes)}`,
        example: 'https://acme.monday.com/boards/1234567890/pulses/1234567891',
      };
    }
    case 'youtrack': {
      const { projects, host } = spec;
      const hosts = host === undefined ? ['youtrack.jetbrains.com', '*.youtrack.cloud', '*.myjetbrains.com'] : [host];
      const keyOk = (key: string): boolean => isYouTrackKey(key, projects);
      return {
        find: (t) => {
          if (YOUTRACK_KEY_RE.test(t)) return keyId(t, keyOk);
          const url = parseUrl(t);
          return url && hostInList(url, hosts) ? keyId(YOUTRACK_PATH_RE.exec(url.pathname)?.[1], keyOk) : undefined;
        },
        expected: `a YouTrack issue like ${projects?.[0] ?? 'PROJ'}-123${describeList('in project', projects)}, or a YouTrack issue link${host === undefined ? '' : ` on ${host}`}`,
        example: `${projects?.[0] ?? 'PROJ'}-123`,
      };
    }
    case 'basecamp':
      return {
        find: (t) => {
          const url = parseUrl(t);
          return url && hostMatches(url, '3.basecamp.com') ? BASECAMP_PATH_RE.exec(url.pathname)?.[1] : undefined;
        },
        expected: 'a Basecamp to-do or card link like https://3.basecamp.com/4821/buckets/4822/todos/4823',
        example: 'https://3.basecamp.com/4821/buckets/4822/todos/4823',
      };
    case 'shortcut':
      return {
        find: (t) => {
          // `sc-123` fills the first group and `[sc-123]` the second.
          const ref = SHORTCUT_REF_RE.exec(t)?.slice(1).find(Boolean);
          if (ref !== undefined) return ref;
          const url = parseUrl(t);
          return url && hostInList(url, ['app.shortcut.com', 'app.clubhouse.io'])
            ? SHORTCUT_PATH_RE.exec(url.pathname)?.[1]
            : undefined;
        },
        expected: 'a Shortcut story like sc-123, or a story link',
        example: 'sc-123',
      };
    case 'openproject': {
      const { host } = spec;
      return {
        find: (t) => {
          if (ISSUE_NUMBER_RE.test(t) || KEY_RE.test(t)) return numberOf(t);
          const url = parseUrl(t);
          if (!url || host === undefined || !hostMatches(url, host)) return undefined;
          return OPENPROJECT_PATH_RE.exec(url.pathname)?.[1] ?? OPENPROJECT_SHORT_RE.exec(url.pathname)?.[1];
        },
        expected:
          host === undefined
            ? 'an OpenProject work package like #4821 or AGILE-1 (set host to accept work package links)'
            : `an OpenProject work package like #4821 or AGILE-1, or a work package URL on ${host}`,
        example: '#4821',
      };
    }
    case 'bugzilla': {
      const { host } = spec;
      return {
        find: (t) => {
          if (DIGITS_RE.test(t)) return t;
          const url = parseUrl(t);
          if (!url || host === undefined || !hostMatches(url, host)) return undefined;
          if (!BUGZILLA_CGI_RE.test(url.pathname)) return undefined;
          const id = url.searchParams.get('id');
          return id !== null && DIGITS_RE.test(id) ? id : undefined;
        },
        expected:
          host === undefined
            ? 'a Bugzilla bug number like 4821 (set host to accept bug links)'
            : `a Bugzilla bug number like 4821, or a bug URL on ${host}`,
        example: '4821',
      };
    }
    case 'phabricator': {
      const { host } = spec;
      return {
        find: (t) => {
          const ref = PHABRICATOR_REF_RE.exec(t)?.[1];
          if (ref !== undefined) return ref;
          const url = parseUrl(t);
          return url && host !== undefined && hostMatches(url, host)
            ? PHABRICATOR_PATH_RE.exec(url.pathname)?.[1]
            : undefined;
        },
        expected:
          host === undefined
            ? 'a Phabricator task like T4821 (set host to accept task links)'
            : `a Phabricator task like T4821, or a task URL on ${host}`,
        example: 'T4821',
      };
    }
    case 'rally':
      return {
        find: (t) => RALLY_REF_RE.exec(t)?.[1],
        expected: 'a Rally formatted ID like US4821, DE4821, TA4821 or TC4821, without a leading zero',
        example: 'US4821',
      };
    case 'servicenow': {
      // The schema checks `prefixes` when options come from settings; direct use of compileTicketSpec checks it here.
      const prefixes = (spec as { prefixes?: string[] }).prefixes;
      if (
        prefixes === undefined ||
        prefixes.length === 0 ||
        !prefixes.every((prefix) => /^[A-Z][A-Z0-9_]+$/.test(prefix))
      ) {
        throw new ConfigError(
          'the "servicenow" ticket preset needs a `prefixes` array of uppercase record-number prefixes, such as ["STRY"].',
        );
      }
      const re = new RegExp(`^(?:${prefixes.join('|')})(\\d+)$`);
      return {
        find: (t) => re.exec(t)?.[1],
        expected: `a ServiceNow record number like ${prefixes[0]}0010001${describeList('with prefix', prefixes)}`,
        example: `${prefixes[0]}0010001`,
      };
    }
    case 'plane': {
      const { projects, host } = spec;
      const hosts = host === undefined ? ['app.plane.so'] : [host];
      const keyOk = (key: string): boolean => KEY_RE.test(key) && keyInList(key, projects);
      return {
        find: (t) => {
          if (KEY_RE.test(t)) return keyId(t, keyOk);
          const url = parseUrl(t);
          if (!url || !hostInList(url, hosts)) return undefined;
          const found = PLANE_PATH_RE.exec(url.pathname)?.[1];
          // A key link honors `projects` too; a UUID link stands on its own.
          return found === undefined ? undefined : KEY_RE.test(found) ? keyId(found, keyOk) : found;
        },
        expected: `a Plane work item like ${projects?.[0] ?? 'WEB'}-142${describeList('in project', projects)}, or a Plane work item link${host === undefined ? '' : ` on ${host}`}`,
        example: `${projects?.[0] ?? 'WEB'}-142`,
      };
    }
    case 'url': {
      const { hosts } = spec;
      return {
        find: (t) => {
          const url = parseUrl(t);
          if (!url || !hostInList(url, hosts)) return undefined;
          // The site's home page is no ticket; a query or a `#/route` after it can be.
          return url.pathname === '/' && url.search === '' && url.hash === '' ? undefined : linkId(url);
        },
        expected: `a link to ${orList(hosts)}`,
        generic: true,
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
        find: (t) => (DIGITS_RE.test(t) && t.length >= min && t.length <= max ? t : undefined),
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
      // The regex is the user's, so the ID is the whole ticket; one that ends in a zero ID is a placeholder.
      return {
        find: (t) => (re.test(t) ? (ZERO_ID_RE.test(t) ? '0' : t) : undefined),
        expected: `a ticket matching /${spec.pattern}/`,
        example: 'TICKET',
        generic: true,
      };
    }
  }
}

/**
 * Matches a `*` wildcard placeholder against a ticket, case-insensitively, in one pass. A regex with `.*` per
 * star backtracks on a placeholder like `*a*a*a*a*b`, which a user can write by hand.
 */
function matchesGlob(glob: string, value: string): boolean {
  const pattern = glob.toLowerCase();
  const text = value.toLowerCase();
  let p = 0;
  let t = 0;
  let star = -1;
  let mark = 0;
  while (t < text.length) {
    if (p < pattern.length && pattern[p] === text[t]) {
      p += 1;
      t += 1;
    } else if (p < pattern.length && pattern[p] === '*') {
      star = p;
      p += 1;
      mark = t;
    } else if (star !== -1) {
      mark += 1;
      t = mark;
      p = star + 1;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === '*') p += 1;
  return p === pattern.length;
}

export function compileTicketSpec(specs: TicketSpec[], placeholders: string[]): TicketMatcher {
  const presets = specs.map(compilePreset);
  return {
    check(ticket) {
      const bare = ticket.replace(/^#/, '');
      if (placeholders.some((glob) => matchesGlob(glob, ticket) || matchesGlob(glob, bare))) return 'placeholder';
      for (const generic of [false, true]) {
        const ids = presets.flatMap((preset) =>
          Boolean(preset.generic) === generic ? (preset.find(ticket) ?? []) : [],
        );
        if (ids.length > 0) return ids.some((id) => !ZERO_RE.test(id)) ? 'ok' : 'placeholder';
      }
      // No preset reads it. A link is a placeholder only when its own ID is 0, not its title.
      const url = parseUrl(ticket);
      return (url ? ZERO_RE.test(linkId(url)) : ZERO_ID_RE.test(ticket)) ? 'placeholder' : 'format';
    },
    expected: presets.map((p) => p.expected).join('; or '),
    example: presets[0].example,
  };
}
