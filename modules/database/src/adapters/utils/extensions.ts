import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
const deepdash = require('deepdash/standalone');

function deepFieldValidate(extFields: any) {
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

export function validateExtensionFields(schema: any, extFields: any, extOwner: string) {
  const duplicateError = new GrpcError(
    status.ALREADY_EXISTS,
    'Schema extension contains duplicate fields',
  );
  for (const field of Object.keys(extFields)) {
    if (field in schema.fields) throw duplicateError;
  }
  if (schema.fields.extensions) {
    for (const ext of schema.fields.extensions) {
      if (ext.ownerModule === extOwner) continue;
      for (const field of Object.keys(extFields)) {
        if (field in ext.fields) throw duplicateError;
      }
    }
  }
  deepFieldValidate(extFields);
}

export function stitchSchema(schema: any) {
  // TODO Deep copy and return instead?
  if (!schema.extensions) schema.extensions = [];
  schema.extensions.forEach((ext: any) => {
    Object.keys(ext.fields).forEach((field: any) => {
      schema.fields[field] = ext.fields[field];
    });
  });
}
