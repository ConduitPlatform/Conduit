import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultCommunicationsConfig,
  legacyConfigsSafeToRemove,
  mergeLegacyChannelConfigs,
} from './legacyConfigMigration.js';

// Shapes as stored by the 0.16 email / pushNotifications modules.
const legacyEmail = {
  active: true,
  transport: 'smtp',
  sendingDomain: 'example.com',
  transportSettings: {
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      ignoreTls: false,
      auth: { username: 'user', password: 'pass', method: 'PLAIN' },
    },
  },
};
const legacyPush = {
  active: true,
  providerName: 'firebase',
  firebase: { projectId: 'proj', privateKey: 'key', clientEmail: 'svc@proj.com' },
};

describe('mergeLegacyChannelConfigs', () => {
  it('migrates legacy channels into a default communications config', () => {
    const defaults = getDefaultCommunicationsConfig();
    const { config, migratedChannels } = mergeLegacyChannelConfigs(
      defaults,
      { email: legacyEmail, pushNotifications: legacyPush },
      defaults,
    );
    assert.deepEqual(migratedChannels, ['email', 'pushNotifications']);
    assert.equal(config.email.active, true);
    assert.equal(config.email.sendingDomain, 'example.com');
    assert.equal(config.pushNotifications.active, true);
    assert.equal(config.pushNotifications.providerName, 'firebase');
    assert.deepEqual(config.sms, defaults.sms);
  });

  it('migrates into a disabled channel that was edited away from defaults', () => {
    const defaults = getDefaultCommunicationsConfig();
    const current = getDefaultCommunicationsConfig();
    current.pushNotifications.firebase.projectId = 'typed-in-ui';
    const { config, migratedChannels } = mergeLegacyChannelConfigs(
      current,
      { pushNotifications: legacyPush },
      defaults,
    );
    assert.deepEqual(migratedChannels, ['pushNotifications']);
    assert.equal(config.pushNotifications.active, true);
    assert.equal(config.pushNotifications.firebase.projectId, 'proj');
  });

  it('never overwrites an enabled communications channel', () => {
    const defaults = getDefaultCommunicationsConfig();
    const current = getDefaultCommunicationsConfig();
    current.email.active = true;
    current.email.sendingDomain = 'new.example.com';
    const { config, migratedChannels } = mergeLegacyChannelConfigs(
      current,
      { email: legacyEmail },
      defaults,
    );
    assert.deepEqual(migratedChannels, []);
    assert.equal(config.email.sendingDomain, 'new.example.com');
  });
});

describe('legacyConfigsSafeToRemove', () => {
  it('removes legacy configs once they are reflected in the communications config', () => {
    const defaults = getDefaultCommunicationsConfig();
    const legacy = { email: legacyEmail, pushNotifications: legacyPush };
    const { config } = mergeLegacyChannelConfigs(defaults, legacy, defaults);
    assert.deepEqual(legacyConfigsSafeToRemove(config, legacy), [
      'email',
      'pushNotifications',
    ]);
  });

  it('removes a legacy config when the communications channel is enabled', () => {
    const config = getDefaultCommunicationsConfig();
    config.email.active = true;
    assert.deepEqual(legacyConfigsSafeToRemove(config, { email: legacyEmail }), [
      'email',
    ]);
  });

  it('keeps a legacy config that was not migrated', () => {
    const config = getDefaultCommunicationsConfig();
    config.email.sendingDomain = 'edited.example.com';
    const legacy = { email: { ...legacyEmail, active: false } };
    const { migratedChannels } = mergeLegacyChannelConfigs(
      config,
      legacy,
      getDefaultCommunicationsConfig(),
    );
    assert.deepEqual(migratedChannels, []);
    assert.deepEqual(legacyConfigsSafeToRemove(config, legacy), []);
  });
});
