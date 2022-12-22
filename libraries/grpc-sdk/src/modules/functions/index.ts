import { ConduitModule } from '../../classes/ConduitModule';
import { FunctionsDefinition } from '../../protoUtils/functions';

export class Functions extends ConduitModule<typeof FunctionsDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'functions', url, grpcToken);
    this.initializeClient(FunctionsDefinition);
  }
}
