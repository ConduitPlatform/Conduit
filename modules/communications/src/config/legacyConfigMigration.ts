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

type ChannelConfig = { active?: boolean };

/**
 * A legacy channel config is taken over when the communications channel was never
 * configured (still at defaults), or when it is disabled while the legacy module was
 * enabled. An enabled communications channel is never overwritten.
 */
function shouldMigrateChannel(
  current: ChannelConfig,
  defaults: ChannelConfig,
  legacy: Record<string, unknown>,
): boolean {
  if (isEqual(current, defaults)) return true;
  return !current.active && legacy.active === true;
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

const CHANNEL_MERGERS = {
  email: mergeEmailConfig,
  pushNotifications: mergePushConfig,
  sms: mergeSmsConfig,
} as const;

export function mergeLegacyChannelConfigs(
  currentConfig: Config,
  legacyConfigs: LegacyModuleConfigs,
  defaults: Config = getDefaultCommunicationsConfig(),
): LegacyConfigMergeResult {
  const config = { ...currentConfig };
  const migratedChannels: string[] = [];

  for (const key of LEGACY_MODULE_CONFIG_KEYS) {
    const legacy = legacyConfigs[key];
    if (!hasLegacyConfig(legacy)) continue;
    if (!shouldMigrateChannel(currentConfig[key], defaults[key], legacy)) continue;
    const merge = CHANNEL_MERGERS[key] as (
      current: Config[typeof key],
      legacy: Record<string, unknown>,
    ) => Config[typeof key];
    (config as Record<string, unknown>)[key] = merge(currentConfig[key], legacy);
    migratedChannels.push(key);
  }

  return { config, migratedChannels };
}

/**
 * Legacy module configs that can be deleted without losing settings: those already
 * reflected in the communications config, or whose communications channel is enabled
 * (and therefore authoritative). Anything else is kept so it can still be migrated.
 */
export function legacyConfigsSafeToRemove(
  config: Config,
  legacyConfigs: LegacyModuleConfigs,
): string[] {
  return LEGACY_MODULE_CONFIG_KEYS.filter(key => {
    const legacy = legacyConfigs[key];
    if (!hasLegacyConfig(legacy)) return false;
    const current = config[key];
    if (!current) return false;
    if (current.active) return true;
    const merge = CHANNEL_MERGERS[key] as (
      current: Config[typeof key],
      legacy: Record<string, unknown>,
    ) => Config[typeof key];
    return isEqual(merge(current, legacy), current);
  });
}
