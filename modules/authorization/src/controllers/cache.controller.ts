import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';

export namespace RuleCache {
  export function storeResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
    decision: boolean,
  ) {
    // 6s TTL
    grpcSdk.state!.setKey(
      `ruleCache:${computedTuple}`,
      Boolean(decision).toString(),
      6000,
    );
  }

  export function findResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
  ): Promise<boolean | null> {
    return grpcSdk
      .state!.getKey(`ruleCache:${computedTuple}`)
      .then((value: string | null) => {
        if (!isNil(value)) {
          return Boolean(value);
        }
        return null;
      });
  }
}
