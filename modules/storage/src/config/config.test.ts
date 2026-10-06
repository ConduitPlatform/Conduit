import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import AppConfigSchema from './config.js';

describe('storage config defaults', () => {
  it('defaults to active with the local provider', () => {
    const config = convict(AppConfigSchema).getProperties();
    assert.equal(config.active, true);
    assert.equal(config.provider, 'local');
  });
});
