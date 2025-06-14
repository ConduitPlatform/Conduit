import { Indexable } from '@conduitplatform/grpc-sdk';
import { ConduitRoute, SwaggerRouterMetadata } from '@conduitplatform/hermes';
import { ConfigController } from '@conduitplatform/module-tools';

export const getSwaggerMetadata: () => SwaggerRouterMetadata = () => ({
  urlPrefix: '',
  servers: [
    {
      url: ConfigController.getInstance().config.hostUrl,
      description: 'Your API url',
    },
  ],
  securitySchemes: {
    masterKey: {
      name: 'masterkey',
      type: 'apiKey',
      in: 'header',
      description:
        'Your administrative secret key, configurable through MASTER_KEY env var in Conduit Core',
    },
    adminToken: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'Bearer',
      description: 'An admin authentication token, retrievable through [POST] /login',
    },
  },
  globalSecurityHeaders: [
    {
      masterKey: [],
    },
  ],
  setExtraRouteHeaders(route: ConduitRoute, swaggerRouteDoc: Indexable): void {
    if (route.input.path !== '/login' && route.input.path !== '/modules') {
      swaggerRouteDoc.security = swaggerRouteDoc.security.map(
        (originalSecEntry: { [field: string]: string }) => ({
          ...originalSecEntry,
          adminToken: [],
        }),
      );
    }
    swaggerRouteDoc.responses[401] = {
      description: 'Missing Master Key/Access Token or is otherwise invalid',
    };

    if (route.input.errors) {
      for (const error of route.input.errors) {
        const existingResponse = swaggerRouteDoc.responses[error.code];
        if (existingResponse) {
          if (!existingResponse.description.startsWith('* ')) {
            existingResponse.description = `* ${existingResponse.description}`;
          }
          existingResponse.description += `\n* ${error.description}`;
        } else {
          swaggerRouteDoc.responses[error.code] = {
            description: `* ${error.description}`,
          };
        }
      }
    }
  },
});
