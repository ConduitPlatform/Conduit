import { Indexable } from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/commons';

export type SwaggerRouterMetadata = {
  readonly urlPrefix: string;
  readonly securitySchemes: {
    [field: string]: {
      [field: string]: string;
    };
  };
  readonly globalSecurityHeaders: {
    [field: string]: [];
  }[];
  setExtraRouteHeaders(route: ConduitRoute, swaggerRouteDoc: Indexable): void;
};
