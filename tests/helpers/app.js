import { createApp } from '../../app.js';
import { parseConfig } from '../../config.js';

// Synthetic test credential, never loaded from the local environment.
export const token = 'test-owner-credential-000000000000000000000000';
export const authorization = `Bearer ${token}`;
export const config = parseConfig({ NODE_ENV: 'test', OWNER_API_TOKEN: token });
export const appFor = (dependencies = {}) => createApp({ config, log: () => {}, ...dependencies });
