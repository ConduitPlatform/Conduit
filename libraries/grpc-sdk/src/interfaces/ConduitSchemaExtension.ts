import { ConduitModel } from './Model.js';

export interface ConduitSchemaExtension {
  readonly schemaName: string;
  readonly fields: ConduitModel;
}
