import { ConduitModel, ConduitModelOptions } from '../interfaces';

export class ConduitSchema {
  readonly name: string;
  readonly fields: ConduitModel;
  readonly collectionName: string | ''; // '' on implicit name, updated in createSchemaFromAdapter()
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
    this.collectionName = (collectionName && collectionName !== '') ? collectionName : '';
  }

  get modelSchema(): ConduitModel {
    return this.fields;
  }
}
