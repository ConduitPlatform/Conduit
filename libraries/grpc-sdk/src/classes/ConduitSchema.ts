import { ConduitModel, ConduitModelOptions } from '../interfaces';

export class ConduitSchema {
  readonly name: string;
  readonly fields: ConduitModel;
  readonly collectionName: string;
  readonly modelOptions: ConduitModelOptions;

  constructor(
    name: string,
    fields: ConduitModel,
    modelOptions?: ConduitModelOptions,
    collectionName?: string
  ) {
    this.name = name;
    this.fields = fields;
    this.modelOptions = modelOptions ? modelOptions : {};
    // todo should pluralize like mongoose
    this.collectionName = collectionName ? collectionName : this.name;
  }

  get modelSchema(): ConduitModel {
    return this.fields;
  }
}
