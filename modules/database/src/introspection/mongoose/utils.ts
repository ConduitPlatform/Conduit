/**
 * This function should take as an input a mongo-schema object and convert it to a conduit schema
 */

export function mongoSchemaConverter(mongoSchema: any) {
  console.log(mongoSchema);
  const conduitSchema = {} as any;
  
  for (const field of mongoSchema.fields) {
    const conduitField = conduitSchema[field.name] = {} as any;

    if (Array.isArray(field.type)) {
      conduitField.type = field.type.filter((t : string) => t !== 'Undefined')[0];
    }
    else{
      conduitField.type = field.type;
    }
    // extractProperties(field);
  }
  return conduitSchema;
}

function extractProperties(field: any) {
  delete field.count;
  delete field.total_count;
  delete field.has_duplicates;
  delete field.probability;
  delete field.path;
  delete field.types;
}
