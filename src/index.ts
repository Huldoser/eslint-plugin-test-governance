import { createRequire } from 'node:module';
import type { ESLint, Rule } from 'eslint';
import markerMatchesState from './rules/marker-matches-state.ts';
import noConflictingStates from './rules/no-conflicting-states.ts';
import noOrphanedMarker from './rules/no-orphaned-marker.ts';
import requireTicketInComments from './rules/require-ticket-in-comments.ts';
import requireTicket from './rules/require-ticket.ts';
import { FRAMEWORK_NAMES, type FrameworkName } from './utils/constants.ts';
import { compileOptions, SETTINGS_KEY, type GovernanceOptions } from './utils/options.ts';

export type { FrameworkName } from './utils/constants.ts';
export type { CustomState, GovernanceOptions, StateOverride } from './utils/options.ts';
export type { TicketSpec } from './utils/tickets.ts';

const PLUGIN_NAME = 'test-governance';
// Read at load time so the reported version always matches the published package.
const { version: VERSION } = createRequire(import.meta.url)('../package.json') as { version: string };

export type RuleName =
  | 'require-ticket'
  | 'marker-matches-state'
  | 'no-orphaned-marker'
  | 'no-conflicting-states'
  | 'require-ticket-in-comments';

const ruleModules: Record<RuleName, { meta: { docs: { recommended: 'error' | 'warn' } } }> = {
  'require-ticket': requireTicket,
  'marker-matches-state': markerMatchesState,
  'no-orphaned-marker': noOrphanedMarker,
  'no-conflicting-states': noConflictingStates,
  'require-ticket-in-comments': requireTicketInComments,
};

// Public types come from `eslint` itself, so users don't need typescript-eslint installed.
export const rules = ruleModules as unknown as Record<RuleName, Rule.RuleModule>;

// Every framework config turns on all the rules, at the severity in each rule's `meta.docs.recommended`.
const configRules = Object.fromEntries(
  (Object.keys(ruleModules) as RuleName[]).map((name) => [
    `${PLUGIN_NAME}/${name}`,
    ruleModules[name].meta.docs.recommended,
  ]),
) as Record<`${typeof PLUGIN_NAME}/${RuleName}`, 'error' | 'warn'>;

export interface FlatConfig {
  name: string;
  plugins: Record<string, ESLint.Plugin>;
  rules: Record<string, 'error' | 'warn'>;
  settings?: Record<string, unknown>;
}

/**
 * One config per framework. `playwright`, `jest` and `vitest` turn on the same rules for that framework's
 * tests; point each one at its test files with `files`.
 */
export type ConfigName = FrameworkName;

export interface TestGovernancePlugin extends ESLint.Plugin {
  meta: { name: string; version: string; namespace: string };
  rules: Record<RuleName, Rule.RuleModule>;
  configs: Record<ConfigName, FlatConfig>;
  configure(options?: GovernanceOptions): FlatConfig;
}

const plugin: TestGovernancePlugin = {
  meta: { name: 'eslint-plugin-test-governance', version: VERSION, namespace: PLUGIN_NAME },
  rules,
  configs: {} as Record<ConfigName, FlatConfig>,
  configure,
};

/**
 * Returns the config of `options.framework` with shared options in `settings['test-governance']`,
 * so all rules read the same ticket formats and states.
 */
export function configure(options: GovernanceOptions = {}): FlatConfig {
  compileOptions(options); // fail on a bad config at load time, not on the first lint
  return {
    name: `${PLUGIN_NAME}/${options.framework ?? 'playwright'}`,
    plugins: { [PLUGIN_NAME]: plugin },
    rules: { ...configRules },
    settings: { [SETTINGS_KEY]: options },
  };
}

// Each sets its framework, so it wins over a `configure()` that applies to all files when listed after it.
for (const framework of FRAMEWORK_NAMES) {
  plugin.configs[framework] = configure({ framework });
}

export const configs = plugin.configs;
export default plugin;
/**
 * Makes `require('eslint-plugin-test-governance')` return the plugin itself rather than the module
 * namespace. With the namespace, a CommonJS config that registers the plugin next to
 * `configs.playwright` fails with "Cannot redefine plugin".
 *
 * @internal Left out of the type declarations: TypeScript before 5.6 can't parse a string export
 * name, so it would reject the whole file.
 */
export { plugin as 'module.exports' };
