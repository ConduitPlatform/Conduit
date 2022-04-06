/**
 * This function should take as an input a mongo-schema object and convert it to a conduit schema
 */

export function mongoSchemaConverter(mongoSchema: any) {
  console.log(mongoSchema);
  const conduitSchema = {} as any;
  
  for (const field of mongoSchema.fields) {
    const conduitField = conduitSchema[field.name] = {} as any;

    if (Array.isArray(field.type)) {
      conduitField.type = field.type.filter((t : string) => t !== 'Undefined' && t !== 'Null')[0];
    }
    else{
      conduitField.type = field.type;
    }

    if(conduitField.type === 'Document') {
        conduitField.type = 'Object';
    }
  }
  return conduitSchema;
}
