import { ConduitModel, ConduitSchemaOptions } from '../interfaces';

export class ConduitSchema {
  readonly name: string;
  readonly fields: ConduitModel;
  readonly collectionName: string | ''; // '' on implicit name, updated in createSchemaFromAdapter()
  readonly modelOptions: ConduitSchemaOptions;
  ownerModule: string = 'unknown';
  parentSchema?: string;
  constructor(
    name: string,
    fields: ConduitModel,
    modelOptions?: ConduitSchemaOptions,
    collectionName?: string,
  ) {
    this.name = name;
    this.fields = fields;
    this.modelOptions = modelOptions ?? {};
    this.collectionName = collectionName && collectionName !== '' ? collectionName : '';
  }
}
