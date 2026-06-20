import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getDefaultCommunicationsConfig,
  mergeLegacyChannelConfigs,
} from '../dist/config/legacyConfigMigration.js';

test('legacy email with active:true and sendgrid populates nested email', () => {
  const defaults = getDefaultCommunicationsConfig();
  const legacyEmail = {
    active: true,
    transport: 'sendgrid',
    transportSettings: {
      sendgrid: {
        residency: 'global',
        apiKey: 'sg-legacy-key',
      },
    },
  };

  const { config, migratedChannels } = mergeLegacyChannelConfigs(defaults, {
    email: legacyEmail,
  });

  assert.deepEqual(migratedChannels, ['email']);
  assert.equal(config.email.active, true);
  assert.equal(config.email.transport, 'sendgrid');
  assert.equal(config.email.transportSettings.sendgrid.apiKey, 'sg-legacy-key');
});

test('no legacy config leaves defaults unchanged', () => {
  const defaults = getDefaultCommunicationsConfig();

  const { config, migratedChannels } = mergeLegacyChannelConfigs(defaults, {});

  assert.deepEqual(migratedChannels, []);
  assert.deepEqual(config, defaults);
});

test('existing communications config with real values is not overwritten', () => {
  const defaults = getDefaultCommunicationsConfig();
  const existingConfig = {
    ...defaults,
    email: {
      ...defaults.email,
      active: true,
      transport: 'mailgun',
      transportSettings: {
        ...defaults.email.transportSettings,
        mailgun: {
          apiKey: 'existing-mailgun-key',
          host: 'api.mailgun.net',
          proxy: '',
        },
      },
    },
  };
  const legacyEmail = {
    active: true,
    transport: 'sendgrid',
    transportSettings: {
      sendgrid: {
        residency: 'global',
        apiKey: 'sg-legacy-key',
      },
    },
  };

  const { config, migratedChannels } = mergeLegacyChannelConfigs(existingConfig, {
    email: legacyEmail,
  });

  assert.deepEqual(migratedChannels, []);
  assert.equal(config.email.transport, 'mailgun');
  assert.equal(config.email.transportSettings.mailgun.apiKey, 'existing-mailgun-key');
  assert.equal(config.email.transportSettings.sendgrid.apiKey, '');
});

test('legacy push active:false is preserved instead of forcing active:true', () => {
  const defaults = getDefaultCommunicationsConfig();
  const legacyPush = {
    active: false,
    providerName: 'firebase',
    firebase: {
      projectId: 'legacy-project',
      privateKey: 'legacy-key',
      clientEmail: 'legacy@firebase.com',
    },
  };

  const { config, migratedChannels } = mergeLegacyChannelConfigs(defaults, {
    pushNotifications: legacyPush,
  });

  assert.deepEqual(migratedChannels, ['pushNotifications']);
  assert.equal(config.pushNotifications.active, false);
  assert.equal(config.pushNotifications.providerName, 'firebase');
  assert.equal(config.pushNotifications.firebase.projectId, 'legacy-project');
});
