import { ConduitModel } from '../interfaces';

export class ConduitSchemaExtension {
  readonly name: string;
  readonly fields: ConduitModel;

  constructor(name: string, fields: ConduitModel) {
    this.name = name;
    this.fields = fields;
  }
}
