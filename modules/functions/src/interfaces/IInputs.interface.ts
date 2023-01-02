import { ConduitModel, ConduitRouteOption } from '@conduitplatform/grpc-sdk';

export interface IInputsInterface {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: { [field: string]: any };

  bodyParams?: ConduitRouteOption | ConduitModel;

  urlParams?: ConduitRouteOption | ConduitModel;

  queryParams?: ConduitRouteOption | ConduitModel;
  auth?: boolean;
}
