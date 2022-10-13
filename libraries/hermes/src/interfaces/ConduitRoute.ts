import { Indexable } from '@conduitplatform/grpc-sdk';

export type RouteT = {
  options: any;
  returns?: Indexable;
  grpcFunction: string;
  routeUrl?: string;
};
