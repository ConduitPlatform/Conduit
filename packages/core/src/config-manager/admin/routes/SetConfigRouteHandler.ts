import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/grpc-sdk';
import { ConduitCommons } from '@conduitplatform/commons';

type SetConfig = (config: { newConfig: string }) => { updatedConfig: string };
type GetModuleResponse = { setConfig: SetConfig };

export default async function setConfigRouteHandler(
  newConfig: any,
  moduleName: string,
  grpcSdk: ConduitGrpcSdk,
  conduit: ConduitCommons,
) {
  let updatedConfig;
  switch (moduleName) {
    case 'core':
      updatedConfig = await conduit
        .getCore()
        .setConfig(newConfig)
        .catch(e => {
          throw new ConduitError(e.name, e.status ?? 500, e.message);
        });
      break;
    case 'admin':
      updatedConfig = await conduit
        .getAdmin()
        .setConfig(newConfig)
        .catch(e => {
          throw new ConduitError(e.name, e.status ?? 500, e.message);
        });
      break;
    default:
      updatedConfig = ((await grpcSdk.getModule<any>(
        moduleName,
      )) as unknown as GetModuleResponse)!.setConfig({
        newConfig: JSON.stringify(newConfig),
      }).updatedConfig;
      updatedConfig = JSON.parse(updatedConfig);
  }
  return { result: { config: updatedConfig } };
}
