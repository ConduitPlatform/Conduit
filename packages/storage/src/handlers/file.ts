import { ConduitRouteParameters, ConduitSDK } from '@conduit/sdk';
import { isString } from 'lodash';

export class FileHandlers {
  constructor(private readonly sdk: ConduitSDK) {
  }

  async createFile(params: ConduitRouteParameters) {

    return 'ok';
  }

  async getFile(params: ConduitRouteParameters) {
    const id = params.params?.id;
    if (!isString(id)) {
      throw new Conduit
    }
    return 'ok';
  }
}
