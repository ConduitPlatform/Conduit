import { ConduitModel, ConduitModelField } from '@conduitplatform/grpc-sdk';

export const SYSTEM_DB_SCHEMAS = ['CustomEndpoints','_PendingSchemas','_DeclaredSchema','Config','Client','Admin']; // Check schema entries for cms metadata
export const INITIAL_DB_SCHEMAS = ['_DeclaredSchema', '_PendingSchemas'];

/**
 * This function should take as an input a mongo-schema object and convert it to a conduit schema
 */
export function mongoSchemaConverter(mongoSchema: any): ConduitModel {
  const conduitSchema: Partial<ConduitModel> = {};

  for (const field of mongoSchema.fields) {
    conduitSchema[field.name] = extractType(field);
  }
  return conduitSchema as ConduitModel;
}

function extractType(field: any): ConduitModelField {
  let conduitField: Partial<ConduitModelField> = {};
  if (Array.isArray(field.type)) {
    conduitField.type = field.type.filter(
      (t: string) => t !== 'Undefined' && t !== 'Null'
    )[0];
  } else {
    conduitField.type = field.type;
  }
  if(conduitField.type === 'Document') {
    conduitField.type = 'Object' as any; //workaround for Document types
  }

  conduitField.unique = !field.has_duplicates;

  return conduitField;
}
