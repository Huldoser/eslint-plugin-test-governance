/** A problem with the plugin's options, thrown when the config loads or on the first lint. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(`eslint-plugin-test-governance: ${message}`);
    this.name = 'ConfigError';
  }
}
