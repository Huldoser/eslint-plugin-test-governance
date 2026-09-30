import type { TSESLint } from '@typescript-eslint/utils';
import markerMatchesState from './rules/marker-matches-state.js';
import noConflictingStates from './rules/no-conflicting-states.js';
import noOrphanedMarker from './rules/no-orphaned-marker.js';
import requireTicket from './rules/require-ticket.js';
import { compileOptions, SETTINGS_KEY, type GovernanceOptions } from './utils/options.js';

export type { CustomState, GovernanceOptions, StateOverride } from './utils/options.js';
export type { TicketSpec } from './utils/tickets.js';

const PLUGIN_NAME = 'test-governance';
const VERSION = '0.0.0';

export const rules = {
  'require-ticket': requireTicket,
  'marker-matches-state': markerMatchesState,
  'no-orphaned-marker': noOrphanedMarker,
  'no-conflicting-states': noConflictingStates,
};

type RuleName = keyof typeof rules;

const recommendedRules = Object.fromEntries(
  (Object.keys(rules) as RuleName[]).map((name) => [`${PLUGIN_NAME}/${name}`, rules[name].meta.docs!.recommended]),
) as Record<`${typeof PLUGIN_NAME}/${RuleName}`, 'error' | 'warn'>;

export interface FlatConfig {
  name: string;
  plugins: Record<string, unknown>;
  rules: Record<string, 'error' | 'warn'>;
  settings?: Record<string, unknown>;
}

const plugin = {
  meta: { name: 'eslint-plugin-test-governance', version: VERSION, namespace: PLUGIN_NAME },
  rules: rules as unknown as Record<string, TSESLint.LooseRuleDefinition>,
  configs: {} as { recommended: FlatConfig },
  /**
   * Returns the recommended config with shared options in `settings['test-governance']`,
   * so all rules read the same ticket formats and states.
   */
  configure(options: GovernanceOptions = {}): FlatConfig {
    compileOptions(options); // fail on a bad config at load time, not on the first lint
    return {
      name: `${PLUGIN_NAME}/recommended`,
      plugins: { [PLUGIN_NAME]: plugin },
      rules: { ...recommendedRules },
      settings: { [SETTINGS_KEY]: options },
    };
  },
};

plugin.configs.recommended = {
  name: `${PLUGIN_NAME}/recommended`,
  plugins: { [PLUGIN_NAME]: plugin },
  rules: { ...recommendedRules },
};

export const configs = plugin.configs;
export const configure = plugin.configure;
export default plugin;
