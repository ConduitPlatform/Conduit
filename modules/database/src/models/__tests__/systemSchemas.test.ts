import { describe, expect, it } from '@jest/globals';
import * as models from '../index.js';
import {
  DATABASE_SYSTEM_SCHEMA_NAME_SET,
  DATABASE_SYSTEM_SCHEMAS,
} from '../systemSchemas.js';

describe('database system schema registry', () => {
  const names = DATABASE_SYSTEM_SCHEMAS.map(schema => schema.name);

  it('lists the Database-owned schemas registered as system schemas', () => {
    expect(names).toEqual([
      '_DeclaredSchema',
      'MigratedSchemas',
      'CustomEndpoints',
      '_PendingSchemas',
      'Views',
    ]);
    expect([...DATABASE_SYSTEM_SCHEMA_NAME_SET]).toEqual(names);
  });

  it('stays aligned with the models barrel used for registration', () => {
    const barrelNames = Object.values(models)
      .filter(
        (value): value is { name: string } =>
          typeof value === 'object' && value !== null && 'name' in value,
      )
      .map(schema => schema.name)
      .sort();
    expect(barrelNames).toEqual([...names].sort());
  });
});
