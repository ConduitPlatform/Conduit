import { ConduitModel, ConduitModelOptions } from '../interfaces';

export class ConduitSchema {
  readonly name: string;
  readonly fields: ConduitModel;
  readonly collectionName: string;
  modelOptions: ConduitModelOptions;
  private ownerModule?: string;

  constructor(
    name: string,
    fields: ConduitModel,
    modelOptions?: ConduitModelOptions,
    collectionName?: string
  ) {
    this.name = name;
    this.fields = fields;
    this.modelOptions = modelOptions ? modelOptions : {};
    if (collectionName && collectionName !== '') {
      this.collectionName = collectionName;
    } else {
      this.collectionName = this.name;
    }
  }

  get owner(): string | undefined {
    return this.ownerModule;
  }

  set owner(owner: string | undefined) {
    this.ownerModule = owner;
  }

  get modelSchema(): ConduitModel {
    return this.fields;
  }
}
