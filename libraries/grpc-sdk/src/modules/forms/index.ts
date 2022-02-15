import { ConduitModule } from '../../classes/ConduitModule';
import { FormsDefinition } from '../../protoUtils/forms';

export class Forms extends ConduitModule<typeof FormsDefinition> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(FormsDefinition);
  }

  setConfig(newConfig: any) {
    return this.client!.setConfig(
      { newConfig: JSON.stringify(newConfig) })
      .then(res => {
        return JSON.parse(res.updatedConfig);
      });
  }
}
