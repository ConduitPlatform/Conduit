import { Indexable } from '@conduitplatform/grpc-sdk';
import { ConduitRoute, SwaggerRouterMetadata } from '@conduitplatform/hermes';

export const getSwaggerMetadata: () => SwaggerRouterMetadata = () => ({
  urlPrefix: '',
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
      swaggerRouteDoc.security[0].adminToken = [];
    }
  },
});
