import {
  Context,
  Cookies,
  Indexable,
  Params,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { FileByUrlResponse, FileResponse } from '../protoTypes/storage';

export class StorageParamAdapter {
  constructor() {}

  createParsedRouterRequest(
    params: Params,
    urlParams?: Params,
    queryParams?: Params,
    bodyParams?: Params,
    path?: string,
    headers?: Headers,
    context?: Context,
    cookies?: Cookies,
  ): ParsedRouterRequest {
    return <ParsedRouterRequest>{
      request: {
        params,
        urlParams: urlParams ?? {},
        queryParams: queryParams ?? {},
        bodyParams: bodyParams ?? {},
        path: path ?? '',
        headers: headers,
        context: context ?? {},
        cookies: cookies ?? {},
      },
    };
  }

  getFileResponse(response: UnparsedRouterResponse): FileResponse {
    return {
      id: (response as Indexable)._id,
      url: (response as Indexable).url,
      name: (response as Indexable).name,
    };
  }

  getFileByUrlResponse(response: UnparsedRouterResponse): FileByUrlResponse {
    return {
      id: (response as Indexable).file._id,
      fileUrl: (response as Indexable).file.url,
      name: (response as Indexable).file.name,
      uploadUrl: (response as Indexable).url,
    };
  }
}
