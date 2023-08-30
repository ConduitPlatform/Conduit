import { DeclaredSchemaExtension, Schema } from '../interfaces';
import { ConduitModel, Indexable } from '@conduitplatform/grpc-sdk';

export async function canCreate(moduleName: string, schema: Schema) {
  if (moduleName === 'database' && schema.originalSchema.name === '_DeclaredSchema')
    return true;
  return (
    schema.originalSchema.ownerModule === moduleName ||
    schema.originalSchema.modelOptions.conduit!.permissions!.canCreate
  );
}

export async function canModify(moduleName: string, schema: Schema, data?: Indexable) {
  if (moduleName === 'database' && schema.originalSchema.name === '_DeclaredSchema')
    return true;
  if (
    schema.originalSchema.ownerModule === moduleName ||
    schema.originalSchema.modelOptions.conduit!.permissions!.canModify === 'Everything'
  )
    return true;
  if (
    schema.originalSchema.modelOptions.conduit!.permissions!.canModify ===
      'ExtensionOnly' &&
    data
  ) {
    const extensionFields = schema.originalSchema.extensions
      .filter(
        (extension: DeclaredSchemaExtension) =>
          extension.ownerModule === moduleName || extension.ownerModule === 'database',
      )
      .map((extension: DeclaredSchemaExtension) => extension.fields)
      .map((fields: ConduitModel) => Object.keys(fields));
    const dataFields = Object.keys(data);
    return dataFields.every((field: string) => extensionFields.includes(field));
  }
  return false;
}

export async function canDelete(moduleName: string, schema: Schema) {
  if (moduleName === 'database' && schema.originalSchema.name === '_DeclaredSchema')
    return true;
  return (
    schema.originalSchema.ownerModule === moduleName ||
    schema.originalSchema.modelOptions.conduit!.permissions!.canDelete
  );
}
