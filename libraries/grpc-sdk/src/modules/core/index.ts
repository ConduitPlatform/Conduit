import { ConduitModule } from '../../classes/ConduitModule';
import { CoreDefinition } from '../../protoUtils/core';

export class Core extends ConduitModule<typeof CoreDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'core', url, grpcToken);
    this.initializeClients(CoreDefinition);
  }
}
