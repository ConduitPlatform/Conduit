import { ConduitModule } from '../../classes/ConduitModule';
import { CoreDefinition } from '../../protoUtils/core';

export class Core extends ConduitModule<typeof CoreDefinition> {
  constructor(moduleName: string, url: string) {
    super(moduleName, 'sms', url);
    this.initializeClient(CoreDefinition);
  }
}
