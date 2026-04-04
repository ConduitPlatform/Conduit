import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash-es';

const RULE_CACHE_TTL_MS = 60000;
/** Version keys are bumped on invalidation; TTL prevents unbounded Redis growth for inactive subjects. */
const RULE_CACHE_SUBJECT_VER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Bumps invalidate all cached `can()` resolutions (e.g. resource delete, reindex). */
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

export namespace RuleCache {
  export async function storeResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
    decision: boolean,
  ) {
    const globalVer = await getGlobalVersion(grpcSdk);
    const subject = extractSubjectFromTuple(computedTuple);
    const subjectVer = await getSubjectVersion(grpcSdk, subject);
    await grpcSdk.state!.setKey(
      cacheKey(globalVer, subjectVer, computedTuple),
      Boolean(decision).toString(),
      RULE_CACHE_TTL_MS,
    );
  }

  export async function findResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
  ): Promise<boolean | null> {
    const globalVer = await getGlobalVersion(grpcSdk);
    const subject = extractSubjectFromTuple(computedTuple);
    const subjectVer = await getSubjectVersion(grpcSdk, subject);
    return grpcSdk
      .state!.getKey(cacheKey(globalVer, subjectVer, computedTuple))
      .then((value: string | null) => {
        if (!isNil(value)) {
          return value === 'true';
        }
        return null;
      });
  }

  /** Invalidate cached decisions for one subject (e.g. User:x) after permission/relation changes affecting them. */
  export async function invalidateSubject(grpcSdk: ConduitGrpcSdk, subject: string) {
    await grpcSdk.state!.setKey(
      `${RULE_CACHE_SUBJECT_VER_PREFIX}${subject}`,
      Date.now().toString(),
      RULE_CACHE_SUBJECT_VER_TTL_MS,
    );
  }

  /** Invalidate all subjects (resource teardown, reindex, etc.). */
  export async function invalidateGlobal(grpcSdk: ConduitGrpcSdk) {
    await grpcSdk.state!.setKey(RULE_CACHE_GLOBAL_VERSION_KEY, Date.now().toString());
  }

  /** @deprecated Prefer invalidateSubject / invalidateGlobal */
  export async function invalidate(grpcSdk: ConduitGrpcSdk) {
    await invalidateGlobal(grpcSdk);
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
