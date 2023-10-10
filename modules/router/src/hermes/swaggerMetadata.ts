import { Indexable } from '@conduitplatform/grpc-sdk';
import { ConduitRoute, SwaggerRouterMetadata } from '@conduitplatform/hermes';

export const swaggerMetadata: SwaggerRouterMetadata = {
  urlPrefix: '',
  securitySchemes: {
    clientId: {
      name: 'clientid',
      type: 'apiKey',
      in: 'header',
      description: 'A security client id, retrievable through [POST] /security/client',
    },
    clientSecret: {
      name: 'clientSecret',
      type: 'apiKey',
      in: 'header',
      description:
        'A security client secret, retrievable through [POST] /security/client',
    },
    userToken: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'Bearer',
      description:
        'A user authentication token, retrievable through [POST] /authentication/local or [POST] /authentication/renew',
    },
  },
  globalSecurityHeaders: [
    {
      clientId: [],
      clientSecret: [],
    },
  ],
  setExtraRouteHeaders(route: ConduitRoute, swaggerRouteDoc: Indexable): void {
    if (
      route.input.middlewares?.includes('authMiddleware') ||
      route.input.middlewares?.includes('authMiddleware?')
    ) {
      swaggerRouteDoc.security[0].userToken = [];
    }
  },
};
