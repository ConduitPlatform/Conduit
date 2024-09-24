import { DeclaredSchemaExtension, Schema } from '../interfaces/index.js';
import { Indexable } from '@conduitplatform/grpc-sdk';

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
      .reduce(
        (acc: string[], curr: DeclaredSchemaExtension) => [...acc, ...Object.keys(curr)],
        [],
      );
    const dataFields = Object.keys(data).reduce((acc: string[], curr: string) => {
      const head = curr.split('.')[0];
      if (!acc.includes(head)) acc.push(head);
      return acc;
    }, []);
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
