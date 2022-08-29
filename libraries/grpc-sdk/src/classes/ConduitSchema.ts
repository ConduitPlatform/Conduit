import { ConduitModel, ConduitSchemaOptions } from '../interfaces';

export class ConduitSchema {
  readonly name: string;
  readonly fields: ConduitModel;
  readonly collectionName: string | ''; // '' on implicit name, updated in createSchemaFromAdapter()
  readonly options: ConduitSchemaOptions;
  ownerModule: string = 'unknown';

  constructor(
    name: string,
    fields: ConduitModel,
    options?: ConduitSchemaOptions,
    collectionName?: string,
  ) {
    this.name = name;
    this.fields = fields;
    this.options = options ?? {};
    this.collectionName = collectionName && collectionName !== '' ? collectionName : '';
  }
}
