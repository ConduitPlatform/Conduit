import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { ConduitCommons } from '@conduitplatform/commons';
import { update } from 'lodash';

export function registerConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  conduit: ConduitCommons,
  moduleName: string,
  configSchema: any,
  routeAction: ConduitRouteActions.GET | ConduitRouteActions.PATCH,
) {
  return new ConduitRoute(
    {
      path: `/config/${moduleName}`,
      action: routeAction,
      ...(routeAction === ConduitRouteActions.PATCH && {
        bodyParams: {
          config: { type: configSchema, required: true },
        },
      }),
    },
    new ConduitRouteReturnDefinition(
      routeAction === ConduitRouteActions.GET ? 'GetConfigRoute' : 'SetConfigRoute',
      {
        config: configSchema,
      },
    ),
    async (params: ConduitRouteParameters) => {
      if (routeAction === ConduitRouteActions.GET) {
        let finalConfig;
        finalConfig = await grpcSdk.state!.getKey(`moduleConfigs.${moduleName}`);
        if (!finalConfig) {
          finalConfig = {};
        } else {
          finalConfig = JSON.parse(finalConfig);
        }
        return { result: { config: finalConfig } };
      } else {
        const newConfig = params.params!.config;
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
            updatedConfig = JSON.parse(
              // @ts-ignore
              (
                await grpcSdk
                  .getModule<any>(moduleName)!
                  // @ts-ignore
                  .setConfig({ newConfig: JSON.stringify(newConfig) })
              ).updatedConfig,
            );
        }
        return { result: { config: updatedConfig } };
      }
    },
  );
}
