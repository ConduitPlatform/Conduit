import { Indexable } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { ConduitRoute, SwaggerRouterMetadata } from '@conduitplatform/hermes';

export const getSwaggerMetadata: () => SwaggerRouterMetadata = () => ({
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
          clientSecret: {
            name: 'clientSecret',
            type: 'apiKey',
            in: 'header',
            description:
              'A security client secret, retrievable through [POST] /security/client',
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
          clientSecret: [],
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
