import { ConduitModel } from './Model';

export interface ConduitSchemaExtension {
  readonly schemaName: string;
  readonly fields: ConduitModel;
}
