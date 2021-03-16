import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';

export default class CMS extends ConduitModule {
  constructor(url: string) {
    super(url);
    this.protoPath = path.resolve(__dirname, '../../proto/cms.proto');
    this.descriptorObj = 'cms.CMS';
    this.initializeClient();
  }
}
