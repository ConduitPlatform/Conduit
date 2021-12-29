import { ConduitModel, ConduitModelOptions } from '../interfaces';

export class ConduitSchema {
  readonly name: string;
  readonly fields: ConduitModel;
  readonly collectionName: string;
  readonly schemaOptions: ConduitModelOptions;
  ownerModule: string = 'unknown';

  constructor(
    name: string,
    fields: ConduitModel,
    schemaOptions?: ConduitModelOptions,
    collectionName?: string
  ) {
    this.name = name;
    this.fields = fields;
    this.schemaOptions = schemaOptions ?? {};
    if (collectionName && collectionName !== '') {
      this.collectionName = collectionName;
    } else {
      this.collectionName = this.name;
    }
  }

  get modelSchema(): ConduitModel {
    return this.fields;
  }
}
