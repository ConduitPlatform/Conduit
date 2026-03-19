import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash-es';

const RULE_CACHE_TTL_MS = 60000;
const RULE_CACHE_VERSION_KEY = 'ruleCache:version';

export namespace RuleCache {
  export async function storeResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
    decision: boolean,
  ) {
    const version = await getVersion(grpcSdk);
    await grpcSdk.state!.setKey(
      `ruleCache:${version}:${computedTuple}`,
      Boolean(decision).toString(),
      RULE_CACHE_TTL_MS,
    );
  }

  export async function findResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
  ): Promise<boolean | null> {
    const version = await getVersion(grpcSdk);
    return grpcSdk
      .state!.getKey(`ruleCache:${version}:${computedTuple}`)
      .then((value: string | null) => {
        if (!isNil(value)) {
          return value === 'true';
        }
        return null;
      });
  }

  export async function invalidate(grpcSdk: ConduitGrpcSdk) {
    await grpcSdk.state!.setKey(RULE_CACHE_VERSION_KEY, Date.now().toString());
  }

  async function getVersion(grpcSdk: ConduitGrpcSdk) {
    const version = await grpcSdk.state!.getKey(RULE_CACHE_VERSION_KEY);
    if (isNil(version)) {
      await grpcSdk.state!.setKey(RULE_CACHE_VERSION_KEY, '0');
      return '0';
    }
    return version;
  }
}
