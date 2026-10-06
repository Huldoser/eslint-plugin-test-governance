import { createRequire } from 'node:module';
import type { ESLint, Rule } from 'eslint';
import markerMatchesState from './rules/marker-matches-state.ts';
import noConflictingStates from './rules/no-conflicting-states.ts';
import noOrphanedMarker from './rules/no-orphaned-marker.ts';
import requireTicketInComments from './rules/require-ticket-in-comments.ts';
import requireTicket from './rules/require-ticket.ts';
import { compileOptions, SETTINGS_KEY, type GovernanceOptions } from './utils/options.ts';

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

const recommendedRules = Object.fromEntries(
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

export interface TestGovernancePlugin extends ESLint.Plugin {
  meta: { name: string; version: string; namespace: string };
  rules: Record<RuleName, Rule.RuleModule>;
  configs: { recommended: FlatConfig };
  configure(options?: GovernanceOptions): FlatConfig;
}

const plugin: TestGovernancePlugin = {
  meta: { name: 'eslint-plugin-test-governance', version: VERSION, namespace: PLUGIN_NAME },
  rules,
  configs: {} as { recommended: FlatConfig },
  configure,
};

/**
 * Returns the recommended config with shared options in `settings['test-governance']`,
 * so all rules read the same ticket formats and states.
 */
export function configure(options: GovernanceOptions = {}): FlatConfig {
  compileOptions(options); // fail on a bad config at load time, not on the first lint
  return {
    name: `${PLUGIN_NAME}/recommended`,
    plugins: { [PLUGIN_NAME]: plugin },
    rules: { ...recommendedRules },
    settings: { [SETTINGS_KEY]: options },
  };
}

plugin.configs.recommended = {
  name: `${PLUGIN_NAME}/recommended`,
  plugins: { [PLUGIN_NAME]: plugin },
  rules: { ...recommendedRules },
};

export const configs = plugin.configs;
export default plugin;
// Makes `require('eslint-plugin-test-governance')` return the plugin itself rather than the module
// namespace. With the namespace, a CommonJS config that registers the plugin next to
// `configs.recommended` fails with "Cannot redefine plugin".
export { plugin as 'module.exports' };
