import { SchemaAdapter } from '../interfaces';

export async function canExtend(moduleName: string, schema: SchemaAdapter<any>) {
  if (schema.originalSchema.ownerModule === 'unknown') { // remove this at some point
    console.warn(`Deprecation Warning: Disabling permission check for ${schema.originalSchema.name} schema. Update schema ownership.`);
    return true;
  }
  return (
    schema.originalSchema.ownerModule === moduleName ||
    schema.originalSchema.schemaOptions.conduit!.permissions.extendable
  )
}

export async function canCreate(moduleName: string, schema: SchemaAdapter<any>) {
  if (moduleName === 'database' && schema.originalSchema.name === '_DeclaredSchema') return true;
  if (schema.originalSchema.ownerModule === 'unknown') { // remove this at some point
    console.warn(`Deprecation Warning: Disabling permission check for ${schema.originalSchema.name} schema. Update schema ownership.`);
    return true;
  }
  return (
    schema.originalSchema.ownerModule === moduleName ||
    schema.originalSchema.schemaOptions.conduit!.permissions.extendable
  )
}

export async function canModify(moduleName: string, schema: SchemaAdapter<any>) {
  if (moduleName === 'database' && schema.originalSchema.name === '_DeclaredSchema') return true;
  if (schema.originalSchema.ownerModule === 'unknown') { // remove this at some point
    console.warn(`Deprecation Warning: Disabling permission check for ${schema.originalSchema.name} schema. Update schema ownership.`);
    return true;
  }
  return (
    schema.originalSchema.ownerModule === moduleName ||
    (schema.originalSchema.schemaOptions.conduit!.permissions.canModify === 'Everything')
    // TODO: Handle 'ExtensionOnly' once we get extensions
  );
}

export async function canDelete(moduleName: string, schema: SchemaAdapter<any>) {
  if (moduleName === 'database' && schema.originalSchema.name === '_DeclaredSchema') return true;
  if (schema.originalSchema.ownerModule === 'unknown') { // remove this at some point
    console.warn(`Deprecation Warning: Disabling permission check for ${schema.originalSchema.name} schema. Update schema ownership.`);
    return true;
  }
  return (
    schema.originalSchema.ownerModule === moduleName ||
    schema.originalSchema.schemaOptions.conduit!.permissions.canDelete
  );
}
