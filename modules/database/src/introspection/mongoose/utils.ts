import { ARRAY_TYPE, ConduitModel, ConduitModelField, Indexable, TYPE } from '@conduitplatform/grpc-sdk';

export const INITIAL_DB_SCHEMAS = [
  '_declaredschemas',
  'customendpoints',
  '_pendingschemas',
];

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

function extractType(field: Indexable): ConduitModelField {
  let conduitField: Partial<ConduitModelField> = {};
  if (Array.isArray(field.type)) {
    conduitField.type = field.type.filter(
      (t: string) => t !== 'Undefined' && t !== 'Null'
    )[0];
  }
  else if (field.type === 'Array' && field.hasOwnProperty('types')) {
    let nestedField = field.types[0];
    while(nestedField.hasOwnProperty('types'))
      nestedField = nestedField.types[0];
    conduitField.type = [{type: nestedField.name}];
  }
   else {
    conduitField.type = field.type;
  }
  if(conduitField.type === 'Document') {
    conduitField.type = 'Object' as any; //workaround for Document types
  }
  return conduitField;
}
