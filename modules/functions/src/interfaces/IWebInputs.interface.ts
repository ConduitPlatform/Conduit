import {
  ConduitModel,
  ConduitQueryParams,
  ConduitUrlParams,
} from '@conduitplatform/grpc-sdk';

export interface IWebInputsInterface {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  event?: string;
  bodyParams?: ConduitModel;
  urlParams?: ConduitUrlParams;
  queryParams?: ConduitQueryParams;
  auth?: boolean;
}
