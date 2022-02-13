import { ConduitModule } from '../../classes/ConduitModule';
import { CMSDefinition } from '../../protoUtils/cms';

export class CMS extends ConduitModule<typeof CMSDefinition> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(CMSDefinition);
  }
}
