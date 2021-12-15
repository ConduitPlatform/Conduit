import { ConduitModule } from '../../classes/ConduitModule';
import { CMSClient } from '../../protoUtils/cms';

export class CMS extends ConduitModule<CMSClient> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(CMSClient);
  }
}
