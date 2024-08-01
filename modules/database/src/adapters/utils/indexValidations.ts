import { ConduitModel, GrpcError, ModelOptionsIndex } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConduitDatabaseSchema } from '../../interfaces/index.js';

export function validateIndexFields(
  schema: ConduitDatabaseSchema,
  index: ModelOptionsIndex,
  callerModule: string,
) {
  const compiledFields = schema.compiledFields;
  if (index.fields.some(field => !Object.keys(compiledFields).includes(field))) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid fields for index creation');
  }

  let ownedExtensionFields: ConduitModel = {};
  for (const ext of schema.extensions) {
    if (ext.ownerModule === callerModule) {
      ownedExtensionFields = ext.fields;
      break;
    }
  }

  const isOwnerOfSchema = schema.ownerModule === callerModule;
  for (const field of index.fields) {
    if (index.options?.unique && !(field in ownedExtensionFields) && !isOwnerOfSchema) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Not authorized to create unique index',
      );
    }
  }
}
