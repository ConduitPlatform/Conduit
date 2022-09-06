import { ConduitModel } from '.';

export interface ConduitSchemaExtension {
  readonly schemaName: string;
  readonly fields: ConduitModel;
}
