import {
  ConduitGrpcSdk,
  ConduitModel,
  ConduitReturn,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
// Removed ConduitCommons import - now using configManager directly
import { ConduitRoute } from '@conduitplatform/hermes';
import { ModuleError, redactSensitiveConfig } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';
import convict from 'convict';

type SetConfig = (config: { newConfig: string }) => Promise<{ updatedConfig: string }>;
type GetModuleResponse = { setConfig: SetConfig };

/**
 * Errors that already carry a gRPC status (typed errors, errors returned by a module)
 * or an HTTP status pass through unchanged. Unknown failures become CONFIG_UPDATE_FAILED.
 */
function rethrowConfigError(e: unknown): never {
  if (typeof (e as { status?: unknown } | null)?.status === 'number') throw e;
  throw ModuleError.from(e, errors.CONFIG_UPDATE_FAILED);
}

export function setModuleConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  configManager: any,
  moduleName: string,
  configSchema: convict.Config<unknown>,
) {
  return new ConduitRoute(
    {
      path: `/config/${moduleName}`,
      action: ConduitRouteActions.PATCH,
      description: `Updates ${moduleName} module configuration.`,
      bodyParams: {
        config: { type: configSchema as unknown as ConduitModel, required: true },
      },
      errors: [
        errors.CONFIG_VALIDATION_FAILED,
        errors.MODULE_NOT_AVAILABLE,
        errors.CONFIG_UPDATE_FAILED,
      ],
    },
    new ConduitRouteReturnDefinition(
      `Set${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}ConfigRoute`,
      {
        config: configSchema,
      } as ConduitReturn,
    ),
    async (params: ConduitRouteParameters) => {
      let updatedConfig = params.params!.config;
      switch (moduleName) {
        case 'core':
          updatedConfig = await configManager.core
            .setConfig(updatedConfig)
            .catch(rethrowConfigError);
          break;
        case 'admin':
          updatedConfig = await configManager.adminModule
            .setConfig(updatedConfig)
            .catch(rethrowConfigError);
          break;
        default:
          const moduleClient = grpcSdk.getModuleClient(
            moduleName,
          ) as unknown as GetModuleResponse;
          if (!moduleClient) {
            throw new ModuleError(errors.MODULE_NOT_AVAILABLE);
          }
          updatedConfig = await moduleClient
            .setConfig({
              newConfig: JSON.stringify(updatedConfig),
            })
            .catch(rethrowConfigError);
          updatedConfig = JSON.parse(updatedConfig.updatedConfig);
      }
      await configManager.set(moduleName, updatedConfig);
      return { config: redactSensitiveConfig(updatedConfig, configSchema) };
    },
  );
}
