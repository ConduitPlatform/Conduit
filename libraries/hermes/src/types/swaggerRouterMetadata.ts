import { Indexable } from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '../classes';

export type SwaggerRouterMetadata = {
  readonly servers: {
    url: string;
    description: string;
  }[];
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
