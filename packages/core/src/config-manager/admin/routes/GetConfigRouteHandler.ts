import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export default async function getConfigRouteHandler(
  grpcSdk: ConduitGrpcSdk,
  moduleName: string,
) {
  let finalConfig;
  finalConfig = await grpcSdk.state!.getKey(`moduleConfigs.${moduleName}`);
  if (!finalConfig) {
    finalConfig = {};
  } else {
    finalConfig = JSON.parse(finalConfig);
  }
  return { result: { config: finalConfig } };
}
