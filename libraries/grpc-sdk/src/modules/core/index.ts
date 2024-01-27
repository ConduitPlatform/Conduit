import { ConduitModule } from '../../classes/index.js';
import { CoreDefinition } from '../../protoUtils/core.js';

export class Core extends ConduitModule<typeof CoreDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'core', url, grpcToken);
    this.initializeClient(CoreDefinition);
  }
}
