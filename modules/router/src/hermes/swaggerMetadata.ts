import { Indexable } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { ConduitRoute, SwaggerRouterMetadata } from '@conduitplatform/hermes';

export const getSwaggerMetadata: () => SwaggerRouterMetadata = () => ({
  servers: [
    {
      url: ConfigController.getInstance().config.hostUrl,
      description: 'Your API url',
    },
  ],
  urlPrefix: '',
  securitySchemes: {
    ...(ConfigController.getInstance().config.security.clientValidation
      ? {
          clientId: {
            name: 'clientId',
            type: 'apiKey',
            in: 'header',
            description:
              'A security client id, retrievable through [POST] /security/client',
          },
          'x-conduit-timestamp': {
            name: 'x-conduit-timestamp',
            type: 'apiKey',
            in: 'header',
            description:
              'Unix time in milliseconds. The router rejects the request when this is more than 5 minutes from the server clock.',
          },
          'x-conduit-signature': {
            name: 'x-conduit-signature',
            type: 'apiKey',
            in: 'header',
            description:
              'Hex HMAC-SHA256 of the timestamp, method, path and query, and the SHA-256 of the raw body, keyed with the client secret.',
          },
        }
      : {}),
    userToken: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'Bearer',
      description:
        'A user authentication token, retrievable through [POST] /authentication/local or [POST] /authentication/renew',
    },
  },
  globalSecurityHeaders: ConfigController.getInstance().config.security.clientValidation
    ? [
        {
          clientId: [],
          'x-conduit-timestamp': [],
          'x-conduit-signature': [],
        },
      ]
    : [],
  setExtraRouteHeaders(route: ConduitRoute, swaggerRouteDoc: Indexable): void {
    // https://swagger.io/docs/specification/authentication/#multiple
    if (route.input.middlewares?.includes('authMiddleware')) {
      if (swaggerRouteDoc.security.length === 0) {
        swaggerRouteDoc.security.push({});
      }
      // Logical AND
      swaggerRouteDoc.security = swaggerRouteDoc.security.map(
        (originalSecEntry: { [field: string]: string }) => ({
          ...originalSecEntry,
          userToken: [],
        }),
      );
      swaggerRouteDoc.responses[401] = {
        description: 'Token missing/invalid or 2fa verification required',
      };
      swaggerRouteDoc.responses[403] = {
        description: 'Permission denied, user may be blocked',
      };
    } else if (route.input.middlewares?.includes('authMiddleware?')) {
      if (swaggerRouteDoc.security.length === 0) {
        swaggerRouteDoc.security.push({});
      }
      // Logical OR
      swaggerRouteDoc.security.forEach(
        (originalSecEntry: { [field: string]: string }) => {
          swaggerRouteDoc.security.push({ ...originalSecEntry, userToken: [] });
        },
      );
    }
  },
});
