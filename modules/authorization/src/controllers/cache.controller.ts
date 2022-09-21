import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';

export namespace RuleCache {
  function storeResolution(
    grpcSdk: ConduitGrpcSdk,
    computedTuple: string,
    decision: boolean,
  ) {
    grpcSdk.state!.setKey(`ruleCache:${computedTuple}`, Boolean(decision).toString());
  }

  function findResolution(
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
