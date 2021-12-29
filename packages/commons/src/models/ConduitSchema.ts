import { ConduitModel, ConduitModelOptions } from '../interfaces';

export class ConduitSchema {
  private readonly _name: string;
  private readonly _fields: ConduitModel;
  private readonly _collectionName: string;
  private readonly _schemaOptions: ConduitModelOptions;
  ownerModule: string = 'unknown';

  constructor(
    name: string,
    fields: ConduitModel,
    schemaOptions?: ConduitModelOptions,
    collectionName?: string
  ) {
    this._name = name;
    this._fields = fields;
    this._schemaOptions = schemaOptions ?? {};
    // todo should pluralize like mongoose
    if (collectionName && collectionName !== '') {
      this._collectionName = collectionName;
    } else {
      this._collectionName = this._name;
    }
  }

  get name(): string {
    return this._name;
  }

  get fields(): ConduitModel {
    return this._fields;
  }

  get modelSchema(): ConduitModel {
    return this._fields;
  }

  get collectionName(): string {
    return this._collectionName;
  }

  get schemaOptions(): ConduitModelOptions {
    return this._schemaOptions;
  }
}
