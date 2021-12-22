import { _DeclaredSchema } from '../models';
import { ConduitModelOptions, GrpcError } from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';

export async function canExtend(moduleName: string, schemaName: string) {
  const schema = await _DeclaredSchema.getInstance()
    .findOne({ name: schemaName })
    .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
  if (!schema) {
    throw new GrpcError(status.NOT_FOUND, `Cannot extend non-existent schema '${schemaName}'`);
  }
  return (
    (schema as any).ownerModule === moduleName ||
    (schema.modelOptions.conduit as ConduitModelOptions).permissions!.extendable
  )
}

export async function canCreate(moduleName: string, schemaName: string) {
  if ((moduleName === 'database' || moduleName === 'cms') && schemaName === '_DeclaredSchema') {
    return true;
  }
  const schema = await _DeclaredSchema.getInstance()
    .findOne({ name: schemaName })
    .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
  if (!schema) {
    // Possible race-condition between internal schemas and CMS
    throw new GrpcError(status.NOT_FOUND, `Schema '${schemaName}' does not exist`);
  }
  return (
    (schema as any).ownerModule === moduleName ||
    (schema.modelOptions.conduit as ConduitModelOptions).permissions!.canCreate
  )
}

export async function canModify(
  moduleName: string,
  schemaName: string,
) {
  if (moduleName === 'database' && schemaName === '_DeclaredSchema') return true;
  const schema = await _DeclaredSchema.getInstance()
    .findOne({ name: schemaName })
    .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
  if (!schema) return true;
  return (
    (schema as any).ownerModule === moduleName ||
    ((schema.modelOptions.conduit as ConduitModelOptions).permissions!.canModify === 'Everything')
    // TODO: Handle 'ExtensionOnly' once we get extensions
  );
}

export async function canDelete(
  moduleName: string,
  schemaName: string,
) {
  if (moduleName === 'database' && schemaName === '_DeclaredSchema') return true;
  const schema = await _DeclaredSchema.getInstance()
    .findOne({ name: schemaName })
    .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
  if (!schema) return true;
  return (
    (schema as any).ownerModule === moduleName ||
    (schema.modelOptions.conduit as ConduitModelOptions).permissions!.canDelete
  );
}
