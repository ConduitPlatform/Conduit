import { Indexable, UnparsedRouterResponse } from '@conduitplatform/grpc-sdk';
import { FileByUrlResponse, FileResponse } from '../protoTypes/storage.js';

export class StorageParamAdapter {
  constructor() {}

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
