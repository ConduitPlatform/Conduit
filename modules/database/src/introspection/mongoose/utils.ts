import { ConduitModel, Indexable, TYPE } from '@conduitplatform/grpc-sdk';

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

function extractType(field: Indexable) {
  const conduitField: Indexable = {};
  if (Array.isArray(field.type)) {
    conduitField.type = field.type.filter(
      (t: string) => t !== 'Undefined' && t !== 'Null',
    )[0];
  } else if (
    (field.type === 'Array' || field.name === 'Array') &&
    field.hasOwnProperty('types')
  ) {
    let nestedField = field.types[0];
    nestedField = extractType(nestedField.types[0]);
    return [nestedField];
  } else {
    conduitField.type = field.type ?? field.name;
  }
  if ((conduitField.type as any) === 'Document') {
    conduitField.type = TYPE.JSON; //workaround for Document types
  }
  if (conduitField.type === TYPE.ObjectId) {
    conduitField.type = TYPE.ObjectId; // fix casing for ObjectID
  }

  return conduitField;
}
