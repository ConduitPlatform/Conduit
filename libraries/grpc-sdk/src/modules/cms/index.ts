import { ConduitModule } from '../../classes/ConduitModule';
import { CMSClient } from '../../protoUtils/cms';

export class CMS extends ConduitModule<CMSClient> {
  constructor(url: string) {
    super(url);
    this.initializeClient(CMSClient);
  }
}
