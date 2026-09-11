import { containsRedactedMarker } from './redactSensitiveConfig.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortJson(nested)]),
  );
}

export function stableConfigJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function storedConfigsEquivalent(left: unknown, right: unknown): boolean {
  return stableConfigJson(left) === stableConfigJson(right);
}

export async function reconcileStoredModuleConfig<T>(args: {
  stored: T;
  migrated: T;
  configureOverride: (config: T) => Promise<T>;
}): Promise<{ config: T; persisted: boolean }> {
  if (storedConfigsEquivalent(args.stored, args.migrated)) {
    return { config: args.migrated, persisted: false };
  }
  if (containsRedactedMarker(args.migrated)) {
    return { config: args.migrated, persisted: false };
  }
  const persisted = await args.configureOverride(args.migrated);
  return { config: persisted, persisted: true };
}
