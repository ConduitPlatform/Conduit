import { Indexable, UnparsedRouterResponse } from '@conduitplatform/grpc-sdk';
import { FileByUrlResponse, FileResponse } from '../protoTypes/storage.js';

export class StorageParamAdapter {
  constructor() {}

  getFileResponse(response: UnparsedRouterResponse): FileResponse {
    const file = response as Indexable;
    return {
      id: file._id,
      url: file.url ?? '',
      uri: file.uri ?? '',
      name: file.name,
    };
  }

  getFileByUrlResponse(response: UnparsedRouterResponse): FileByUrlResponse {
    const file = (response as Indexable).file as Indexable;
    return {
      id: file._id,
      fileUrl: file.url ?? file.uri ?? '',
      uri: file.uri ?? '',
      name: file.name,
      uploadUrl: (response as Indexable).url,
    };
  }
}
