import { SequelizeAdapter } from '../index.js';

export class SQLAdapter extends SequelizeAdapter {
  constructor(connectionUri: string) {
    super(connectionUri);
  }

  protected async hasLegacyCollections() {
    return false;
  }
}
