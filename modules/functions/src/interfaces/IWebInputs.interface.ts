import {
  ConduitModel,
  ConduitQueryParams,
  ConduitUrlParams,
} from '@conduitplatform/grpc-sdk';

export interface IWebInputsInterface {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  bodyParams?: ConduitModel;

  urlParams?: ConduitUrlParams;

  queryParams?: ConduitQueryParams;
  auth?: boolean;
}
