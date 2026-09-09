import { CustomEndpoints } from './CustomEndpoints.schema.js';
import { DeclaredSchema } from './DeclaredSchema.schema.js';
import { MigratedSchemas } from './MigratedSchemas.schema.js';
import { PendingSchemas } from './PendingSchemas.schema.js';
import { Views } from './Views.schema.js';

export const DATABASE_SYSTEM_SCHEMAS = [
  DeclaredSchema,
  MigratedSchemas,
  CustomEndpoints,
  PendingSchemas,
  Views,
] as const;

export const DATABASE_SYSTEM_SCHEMA_NAMES: readonly string[] =
  DATABASE_SYSTEM_SCHEMAS.map(schema => schema.name);

export const DATABASE_SYSTEM_SCHEMA_NAME_SET = new Set<string>(
  DATABASE_SYSTEM_SCHEMA_NAMES,
);
