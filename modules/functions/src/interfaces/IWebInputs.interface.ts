import { ConduitModel, ConduitRouteOption } from '@conduitplatform/grpc-sdk';

export interface IWebInputsInterface {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  bodyParams?: ConduitRouteOption | ConduitModel;
  event?: string;
  urlParams?: ConduitRouteOption | ConduitModel;

  queryParams?: ConduitRouteOption | ConduitModel;
  auth?: boolean;
}
