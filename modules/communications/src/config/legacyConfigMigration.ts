import convict from 'convict';
import { isEqual } from 'lodash-es';
import AppConfigSchema from './config.js';
import type { Config } from './index.js';

export type LegacyModuleConfigs = {
  email?: Record<string, unknown> | null;
  pushNotifications?: Record<string, unknown> | null;
  sms?: Record<string, unknown> | null;
};

export type LegacyConfigMergeResult = {
  config: Config;
  migratedChannels: string[];
};

export const LEGACY_MODULE_CONFIG_KEYS = ['email', 'pushNotifications', 'sms'] as const;

export function getDefaultCommunicationsConfig(): Config {
  return convict(AppConfigSchema).getProperties() as Config;
}

function hasLegacyConfig(
  config?: Record<string, unknown> | null,
): config is Record<string, unknown> {
  return !!config && Object.keys(config).length > 0;
}

export function collectLegacyModulesFound(legacyConfigs: LegacyModuleConfigs): string[] {
  return LEGACY_MODULE_CONFIG_KEYS.filter(key => hasLegacyConfig(legacyConfigs[key]));
}

function shouldMigrateChannel(current: unknown, defaults: unknown): boolean {
  return isEqual(current, defaults);
}

function mergeEmailConfig(
  current: Config['email'],
  legacy: Record<string, unknown>,
): Config['email'] {
  return {
    active: (legacy.active as boolean | undefined) ?? current.active,
    transport: (legacy.transport as string | undefined) ?? current.transport,
    sendingDomain: (legacy.sendingDomain as string | undefined) ?? current.sendingDomain,
    transportSettings:
      (legacy.transportSettings as Config['email']['transportSettings']) ??
      current.transportSettings,
    storeEmails:
      (legacy.storeEmails as Config['email']['storeEmails']) ?? current.storeEmails,
  };
}

function mergePushConfig(
  current: Config['pushNotifications'],
  legacy: Record<string, unknown>,
): Config['pushNotifications'] {
  return {
    active: (legacy.active as boolean | undefined) ?? current.active,
    providerName: (legacy.providerName as string | undefined) ?? current.providerName,
    firebase:
      (legacy.firebase as Config['pushNotifications']['firebase']) ?? current.firebase,
    onesignal:
      (legacy.onesignal as Config['pushNotifications']['onesignal']) ?? current.onesignal,
    sns: (legacy.sns as Config['pushNotifications']['sns']) ?? current.sns,
  };
}

function mergeSmsConfig(
  current: Config['sms'],
  legacy: Record<string, unknown>,
): Config['sms'] {
  return {
    active: (legacy.active as boolean | undefined) ?? current.active,
    providerName: (legacy.providerName as string | undefined) ?? current.providerName,
    twilio: (legacy.twilio as Config['sms']['twilio']) ?? current.twilio,
    awsSns: (legacy.awsSns as Config['sms']['awsSns']) ?? current.awsSns,
    messageBird:
      (legacy.messageBird as Config['sms']['messageBird']) ?? current.messageBird,
  };
}

export function mergeLegacyChannelConfigs(
  currentConfig: Config,
  legacyConfigs: LegacyModuleConfigs,
  defaults: Config = getDefaultCommunicationsConfig(),
): LegacyConfigMergeResult {
  const config = { ...currentConfig };
  const migratedChannels: string[] = [];

  if (
    hasLegacyConfig(legacyConfigs.email) &&
    shouldMigrateChannel(currentConfig.email, defaults.email)
  ) {
    config.email = mergeEmailConfig(currentConfig.email, legacyConfigs.email);
    migratedChannels.push('email');
  }

  if (
    hasLegacyConfig(legacyConfigs.pushNotifications) &&
    shouldMigrateChannel(currentConfig.pushNotifications, defaults.pushNotifications)
  ) {
    config.pushNotifications = mergePushConfig(
      currentConfig.pushNotifications,
      legacyConfigs.pushNotifications,
    );
    migratedChannels.push('pushNotifications');
  }

  if (
    hasLegacyConfig(legacyConfigs.sms) &&
    shouldMigrateChannel(currentConfig.sms, defaults.sms)
  ) {
    config.sms = mergeSmsConfig(currentConfig.sms, legacyConfigs.sms);
    migratedChannels.push('sms');
  }

  return { config, migratedChannels };
}
