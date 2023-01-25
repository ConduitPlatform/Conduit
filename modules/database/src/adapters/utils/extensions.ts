import { GrpcError, ConduitModel } from '@conduitplatform/grpc-sdk';
import { ConduitDatabaseSchema, DeclaredSchemaExtension } from '../../interfaces';
import { status } from '@grpc/grpc-js';
const deepdash = require('deepdash/standalone');

function deepFieldValidate(extFields: ConduitModel) {
  const uniqueError = new GrpcError(
    status.INVALID_ARGUMENT,
    "Schema extension fields can not be 'unique'",
  );
  const requiredError = new GrpcError(
    status.INVALID_ARGUMENT,
    "Schema extension fields can not be 'required'",
  );
  deepdash.eachDeep(extFields, (value: any, key: string) => {
    if (key === 'unique' && value === true) throw uniqueError;
    if (key === 'required' && value === true) throw requiredError;
  });
}

export function validateExtensionFields(
  schema: ConduitDatabaseSchema,
  extFields: ConduitModel,
  extOwner: string,
) {
  const duplicateError = new GrpcError(
    status.ALREADY_EXISTS,
    'Schema extension contains duplicate fields',
  );
  for (const field of Object.keys(extFields)) {
    if (field in schema.fields) throw duplicateError;
  }
  for (const ext of schema.extensions) {
    if (ext.ownerModule === extOwner) continue;
    for (const field of Object.keys(extFields)) {
      if (field in ext.fields) throw duplicateError;
    }
  }
  deepFieldValidate(extFields);
}

export function stitchSchema(schema: ConduitDatabaseSchema) {
  // TODO: This gets called from _createSchemaFromAdapter, schema type is missing stuff from ConduitDatabaseSchema

  // Extension array initialization will be redundant once we streamline
  // ConduitSchema -> ConduitDatabaseSchema transformations
  if (!schema.extensions) schema.extensions = [];

  schema.compiledFields = {
    ...JSON.parse(JSON.stringify(schema.fields)),
    ...JSON.parse(JSON.stringify(schema.droppedFields)),
  };
  schema.extensions.forEach((ext: DeclaredSchemaExtension) => {
    Object.keys(ext.fields).forEach(field => {
      schema.compiledFields[field] = ext.fields[field];
    });
  });
}
