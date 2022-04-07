/**
 * This function should take as an input a mongo-schema object and convert it to a conduit schema
 */

import { ConduitModel, ConduitModelField } from '@conduitplatform/grpc-sdk';

export function mongoSchemaConverter(mongoSchema: any) {
console.log(mongoSchema);
  const conduitSchema: Partial<ConduitModel> = {};

  for (const field of mongoSchema.fields) {    
    conduitSchema[field.name] = extractType(field);
  }
  return conduitSchema;
}

function extractType(field: any) : ConduitModelField {
  let conduitField : Partial<ConduitModelField> = {};
  if (Array.isArray(field.type)) {
    conduitField.type = field.type.filter(
      (t: string) => t !== 'Undefined' && t !== 'Null'
    )[0];
  } else {
    conduitField.type = field.type;
  }
  return conduitField;
}
