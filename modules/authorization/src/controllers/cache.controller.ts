import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash-es';

const RULE_CACHE_TTL_MS = 60000;
/** Version keys are bumped on invalidation; TTL prevents unbounded Redis growth for inactive subjects. */
const RULE_CACHE_SUBJECT_VER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Bumps invalidate every cached decision after a resource definition change. */
const RULE_CACHE_GLOBAL_VERSION_KEY = 'ruleCache:globalVer';
const RULE_CACHE_SUBJECT_VER_PREFIX = 'ruleCache:subjVer:';

export function extractSubjectFromTuple(computedTuple: string): string {
  const idx = computedTuple.indexOf('#');
  if (idx === -1) return computedTuple;
  return computedTuple.slice(0, idx);
}

function cacheKey(globalVer: string, subjectVer: string, computedTuple: string) {
  return `ruleCache:${globalVer}:${subjectVer}:${computedTuple}`;
}

export type SubjectPermissionInventoryEntry = {
  action: string;
  direct: boolean;
  inherited: boolean;
  implicit: boolean;
  allowed: boolean;
};

function inventoryCacheKey(
  globalVer: string,
  subjectVer: string,
  subject: string,
  resource: string,
  actionPrefix: string,
) {
  return `ruleCache:${globalVer}:${subjectVer}:inventory:${subject}@${resource}?${actionPrefix}`;
}

/** Versions read before a lookup. Stores must reuse them so a newer invalidation is not overwritten. */
export type RuleCacheVersions = {
  globalVer: string;
  subjectVer: string;
};

export type CachedRule<T> = {
  value: T | null;
  versions: RuleCacheVersions;
};

function parseInventory(stored: string | null) {
  if (isNil(stored)) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isInventoryEntry)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isInventoryEntry(value: unknown): value is SubjectPermissionInventoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.action === 'string' &&
    typeof entry.direct === 'boolean' &&
    typeof entry.inherited === 'boolean' &&
    typeof entry.implicit === 'boolean' &&
    typeof entry.allowed === 'boolean'
  );
}

export namespace RuleCache {
  export async function storeResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
    decision: boolean,
    versions: RuleCacheVersions,
  ) {
    await grpcSdk.state!.setKey(
      cacheKey(versions.globalVer, versions.subjectVer, computedTuple),
      Boolean(decision).toString(),
      RULE_CACHE_TTL_MS,
    );
  }

  export async function findResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
  ): Promise<CachedRule<boolean>> {
    const versions = await readVersions(grpcSdk, extractSubjectFromTuple(computedTuple));
    const stored = await grpcSdk.state!.getKey(
      cacheKey(versions.globalVer, versions.subjectVer, computedTuple),
    );
    return {
      value: isNil(stored) ? null : stored === 'true',
      versions,
    };
  }

  export async function storeInventory(
    grpcSdk: ConduitGrpcSdk,
    subject: string,
    resource: string,
    actionPrefix: string,
    permissions: SubjectPermissionInventoryEntry[],
    versions: RuleCacheVersions,
  ) {
    await grpcSdk.state!.setKey(
      inventoryCacheKey(
        versions.globalVer,
        versions.subjectVer,
        subject,
        resource,
        actionPrefix,
      ),
      JSON.stringify(permissions),
      RULE_CACHE_TTL_MS,
    );
  }

  export async function findInventory(
    grpcSdk: ConduitGrpcSdk,
    subject: string,
    resource: string,
    actionPrefix: string,
  ): Promise<CachedRule<SubjectPermissionInventoryEntry[]>> {
    const versions = await readVersions(grpcSdk, subject);
    const stored = await grpcSdk.state!.getKey(
      inventoryCacheKey(
        versions.globalVer,
        versions.subjectVer,
        subject,
        resource,
        actionPrefix,
      ),
    );
    return { value: parseInventory(stored), versions };
  }

  /** Invalidate cached decisions for one subject (e.g. User:x) after permission/relation changes affecting them. */
  export async function invalidateSubject(grpcSdk: ConduitGrpcSdk, subject: string) {
    await grpcSdk.state!.setKey(
      `${RULE_CACHE_SUBJECT_VER_PREFIX}${subject}`,
      Date.now().toString(),
      RULE_CACHE_SUBJECT_VER_TTL_MS,
    );
  }

  /** Invalidate all subjects after a resource definition is created, updated, or deleted. */
  export async function invalidateGlobal(grpcSdk: ConduitGrpcSdk) {
    await grpcSdk.state!.setKey(RULE_CACHE_GLOBAL_VERSION_KEY, Date.now().toString());
  }

  /** @deprecated Prefer invalidateSubject / invalidateGlobal */
  export async function invalidate(grpcSdk: ConduitGrpcSdk) {
    await invalidateGlobal(grpcSdk);
  }

  async function readVersions(
    grpcSdk: ConduitGrpcSdk,
    subject: string,
  ): Promise<RuleCacheVersions> {
    const globalVer = await getGlobalVersion(grpcSdk);
    const subjectVer = await getSubjectVersion(grpcSdk, subject);
    return { globalVer, subjectVer };
  }

  async function getGlobalVersion(grpcSdk: ConduitGrpcSdk) {
    const version = await grpcSdk.state!.getKey(RULE_CACHE_GLOBAL_VERSION_KEY);
    if (isNil(version)) {
      await grpcSdk.state!.setKey(RULE_CACHE_GLOBAL_VERSION_KEY, '0');
      return '0';
    }
    return version;
  }

  async function getSubjectVersion(grpcSdk: ConduitGrpcSdk, subject: string) {
    const key = `${RULE_CACHE_SUBJECT_VER_PREFIX}${subject}`;
    const version = await grpcSdk.state!.getKey(key);
    if (isNil(version)) {
      await grpcSdk.state!.setKey(key, '0', RULE_CACHE_SUBJECT_VER_TTL_MS);
      return '0';
    }
    return version;
  }
}
