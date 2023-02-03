import {
  ConduitSchema,
  ConduitError,
  ConduitModel,
  ConduitModelField,
} from '@conduitplatform/grpc-sdk';

/*
 * Validates schema field constraints.
 * 'unique' requires 'required'
 */
export function validateFieldConstraints(schema: ConduitSchema) {
  fieldsValidator(schema.name, schema.fields);
}

export function fieldsValidator(schemaName: string, schemaFields: ConduitModel) {
  Object.keys(schemaFields).forEach(f => {
    if (typeof schemaFields[f] === 'object') {
      const target: ConduitModel | ConduitModelField | ConduitModelField[] =
        Array.isArray(schemaFields[f])
          ? (schemaFields[f] as ConduitModelField[])[0]
          : (schemaFields[f] as ConduitModelField);

      const isUnique = !!target.unique;
      const isRequired = !!target.required;
      if (isUnique && !isRequired) {
        throw new ConduitError(
          'INVALID_ARGUMENTS',
          400,
          `Schema '${schemaName}' violates unique field '${f}' constraint (field should be 'required').`,
        );
      }

      if (typeof target.type === 'object') {
        fieldsValidator(schemaName, target.type as ConduitModel);
      }
    }
  });
}
