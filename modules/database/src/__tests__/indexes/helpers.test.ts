import { describe, expect, it } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import {
  CompatibleIndexType,
  MongoIndexType,
  PostgresIndexType,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  assertUniqueIndexPrivilege,
  bindDeclaredIndexesToLive,
  canonicalizeDeclaredIndexFields,
  collectExistingIndexNames,
  collectSchemaIndexFields,
  ensureIndexName,
  generateIndexName,
  indexIdentity,
  isCompatibleIndexType,
  isIndexAlreadyExistsError,
  isMongoIndexType,
  isMongoNamespaceMissingError,
  keepDeclaredIndexExtras,
  liveNameConflictAllowsReuse,
  mapCompatibleToMongo,
  mapCompatibleToSqlOrder,
  mapIndexFieldsToDeclared,
  mapIndexFieldsToSqlEngine,
  mergeDeclaredIndexes,
  mongoAllowsIndexType,
  overlayDeclaredOnLive,
  persistDeclaredSchemaIndexes,
  removeDeclaredIndexes,
  removeIndexFromSchemaFields,
  resolveIndexName,
  sqlDeclaredIndexFieldName,
  sqlDialectAllowsIndexType,
  sqlEngineIndexFieldName,
  sqlIndexFieldNormalizer,
  sqlIndexFields,
  sqlIndexUnsupportedReason,
  validateIndexFields,
} from '../../adapters/utils/indexes.js';

describe('index helpers', () => {
  it('keeps CompatibleIndexType as portable strings, not Mongo 1/-1', () => {
    expect(CompatibleIndexType.Ascending).toBe('Ascending');
    expect(CompatibleIndexType.Descending).toBe('Descending');
    expect(CompatibleIndexType.Ascending).not.toBe(MongoIndexType.Ascending);
    expect(isCompatibleIndexType(CompatibleIndexType.Ascending)).toBe(true);
    expect(isCompatibleIndexType(1)).toBe(false);
    expect(isMongoIndexType('Ascending')).toBe(false);
  });

  it('generates a deterministic name unique per collection', () => {
    const name = generateIndexName(
      ['email'],
      [CompatibleIndexType.Ascending],
      false,
      'cnd_User',
    );
    expect(name).toBe('cnd_idx_cnd_User_email_asc');
    const permission = generateIndexName(
      ['resource'],
      [CompatibleIndexType.Ascending],
      false,
      'cnd_Permission',
    );
    const relationship = generateIndexName(
      ['resource'],
      [CompatibleIndexType.Ascending],
      false,
      'cnd_Relationship',
    );
    expect(permission).toBe('cnd_idx_cnd_Permission_resource_asc');
    expect(relationship).toBe('cnd_idx_cnd_Relationship_resource_asc');
    expect(permission).not.toBe(relationship);
    const unique = generateIndexName(
      ['room', 'createdAt'],
      [CompatibleIndexType.Ascending, CompatibleIndexType.Descending],
      true,
      'cnd_User',
    );
    expect(unique).toBe(
      generateIndexName(
        ['room', 'createdAt'],
        [CompatibleIndexType.Ascending, CompatibleIndexType.Descending],
        true,
        'cnd_User',
      ),
    );
    expect(unique).toMatch(/^cnd_uidx_/);
    expect(unique).toContain('cnd_User');
  });

  it('hashes long names with collectionName in the identity', () => {
    const fields = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
    const left = generateIndexName(fields, undefined, false, 'cnd_VeryLongTableNameOne');
    const right = generateIndexName(fields, undefined, false, 'cnd_VeryLongTableNameTwo');
    expect(left.length).toBeLessThanOrEqual(63);
    expect(right.length).toBeLessThanOrEqual(63);
    expect(left).not.toBe(right);
  });

  it('keeps a provided name on the index and options', () => {
    const named = ensureIndexName(
      {
        fields: ['email'],
        name: 'custom_email_idx',
      },
      'cnd_User',
    );
    expect(resolveIndexName(named)).toBe('custom_email_idx');
    expect(named.options?.name).toBe('custom_email_idx');
  });

  it('maps Compatible and Mongo directions to engine types', () => {
    expect(mapCompatibleToMongo(CompatibleIndexType.Ascending)).toBe(1);
    expect(mapCompatibleToMongo(CompatibleIndexType.Descending)).toBe(-1);
    expect(mapCompatibleToMongo(undefined)).toBe(1);
    expect(mapCompatibleToSqlOrder(CompatibleIndexType.Ascending)).toBe('ASC');
    expect(mapCompatibleToSqlOrder(CompatibleIndexType.Descending)).toBe('DESC');
    expect(sqlIndexFields({ fields: ['createdAt', 'room'] })).toEqual([
      'createdAt',
      'room',
    ]);
    expect(
      sqlIndexFields({
        fields: ['createdAt', 'room'],
        types: [CompatibleIndexType.Descending, CompatibleIndexType.Ascending],
      }),
    ).toEqual([
      { name: 'createdAt', order: 'DESC' },
      { name: 'room', order: 'ASC' },
    ]);
    expect(
      sqlIndexFields({
        fields: ['createdAt'],
        types: [MongoIndexType.Descending],
      }),
    ).toEqual([{ name: 'createdAt', order: 'DESC' }]);
  });

  it('preserves unique when generating a name', () => {
    const unique = ensureIndexName(
      {
        fields: ['email'],
        types: [CompatibleIndexType.Ascending],
        options: { unique: true },
      },
      'cnd_User',
    );
    expect(unique.options?.unique).toBe(true);
    expect(resolveIndexName(unique)).toMatch(/uidx/);
  });

  it('merges declared indexes by name without overwriting the first', () => {
    const merged = mergeDeclaredIndexes(
      [{ fields: ['a'], name: 'idx_a' }],
      [
        { fields: ['a'], name: 'idx_a', options: { unique: true } },
        { fields: ['b'], name: 'idx_b' },
      ],
      'cnd_User',
    );
    expect(merged.map(index => index.name)).toEqual(['idx_a', 'idx_b']);
    expect(merged[0].options?.unique).toBeUndefined();
  });

  it('removes declared indexes and field-level index metadata by name', () => {
    expect(
      removeDeclaredIndexes(
        [
          { fields: ['a'], name: 'idx_a' },
          { fields: ['b'], name: 'idx_b' },
        ],
        ['idx_a'],
      ),
    ).toEqual([{ fields: ['b'], name: 'idx_b' }]);
    expect(
      removeIndexFromSchemaFields({ fields: { a: { index: { name: 'x' } } } }, 'x'),
    ).toBe(true);
  });

  it('rejects unknown index fields', () => {
    expect(() =>
      validateIndexFields(
        { compiledFields: { email: 'String' }, fields: {} },
        { fields: ['missing'] },
      ),
    ).toThrow(/Invalid fields/);
  });

  it('enforces unique-index privilege for owner, Admin, and import', () => {
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'chat',
        callerModule: 'database',
        privileged: false,
      }),
    ).toThrow(expect.objectContaining({ code: status.PERMISSION_DENIED }));
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'chat',
        callerModule: 'chat',
        privileged: false,
      }),
    ).not.toThrow();
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'chat',
        callerModule: 'database',
        privileged: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'authorization',
        callerModule: 'database',
        privileged: false,
      }),
    ).toThrow(/Not authorized to create unique index/);
  });

  it('collects existing names and detects name/relation already-exists errors only', () => {
    expect(
      collectExistingIndexNames([{ fields: ['a'], options: { name: 'idx_a' } }]).has(
        'idx_a',
      ),
    ).toBe(true);
    expect(
      isIndexAlreadyExistsError({
        code: '42P07',
        message: 'relation "x" already exists',
      }),
    ).toBe(true);
    expect(
      isIndexAlreadyExistsError({ code: '1061', message: "Duplicate key name 'x'" }),
    ).toBe(true);
    expect(
      isIndexAlreadyExistsError({
        original: { code: '42P07', message: 'relation "idx" already exists' },
      }),
    ).toBe(true);
    expect(isIndexAlreadyExistsError(new Error('index foo already exists'))).toBe(true);
    expect(isIndexAlreadyExistsError(new Error('already exists'))).toBe(false);
    expect(
      isIndexAlreadyExistsError({ code: 11000, message: 'E11000 duplicate key' }),
    ).toBe(false);
    expect(
      isIndexAlreadyExistsError({
        name: 'SequelizeUniqueConstraintError',
        original: { code: '23505' },
      }),
    ).toBe(false);
    expect(
      isIndexAlreadyExistsError({
        code: 85,
        message: 'Index with name: x already exists',
      }),
    ).toBe(false);
    expect(
      isIndexAlreadyExistsError({
        code: 86,
        message: 'Index already exists with different options',
      }),
    ).toBe(false);
  });

  it('binds unnamed declared indexes to live names by fields+unique', () => {
    const bound = bindDeclaredIndexesToLive(
      [
        {
          fields: ['room', 'createdAt'],
          types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        },
      ],
      [
        {
          name: '_id_',
          fields: ['_id'],
          options: { name: '_id_' },
        },
        {
          name: 'room_1_createdAt_1',
          fields: ['room', 'createdAt'],
          options: { name: 'room_1_createdAt_1', unique: false },
        },
      ],
      'cnd_User',
    );
    expect(resolveIndexName(bound[0])).toBe('room_1_createdAt_1');
    expect(indexIdentity(bound[0])).toEqual({
      fields: ['room', 'createdAt'],
      unique: false,
    });
  });

  it('treats unique vs non-unique as different identities', () => {
    const bound = bindDeclaredIndexesToLive(
      [{ fields: ['email'], options: { unique: true } }],
      [
        {
          name: 'email_1',
          fields: ['email'],
          options: { name: 'email_1', unique: false },
        },
      ],
      'cnd_User',
    );
    expect(resolveIndexName(bound[0])).not.toBe('email_1');
    expect(resolveIndexName(bound[0])).toMatch(/uidx/);
  });

  it('keeps Admin extras and drops stale generated names for the same identity', () => {
    const unioned = keepDeclaredIndexExtras(
      [
        {
          fields: ['room', 'createdAt'],
          name: 'room_1_createdAt_1',
          types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        },
      ],
      [
        {
          fields: ['room', 'createdAt'],
          name: 'cnd_idx_room_createdAt_asc_asc',
        },
        { fields: ['email'], name: 'admin_email_idx' },
      ],
      'cnd_User',
    );
    expect(unioned.map(index => index.name)).toEqual([
      'room_1_createdAt_1',
      'admin_email_idx',
    ]);
  });

  it('overlays declared Compatible types onto live indexes by identity when names differ', () => {
    const overlaid = overlayDeclaredOnLive(
      {
        name: 'room_1_createdAt_1',
        fields: ['room', 'createdAt'],
        types: [MongoIndexType.Ascending, MongoIndexType.Ascending],
        options: { name: 'room_1_createdAt_1' },
      },
      [
        {
          fields: ['room', 'createdAt'],
          name: 'cnd_idx_room_createdAt_asc_asc',
          types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        },
      ],
    );
    expect(overlaid.types).toEqual([
      CompatibleIndexType.Ascending,
      CompatibleIndexType.Ascending,
    ]);
    expect(overlaid.name).toBe('room_1_createdAt_1');
  });

  it('persists applied indexes against a re-read declared schema list', async () => {
    let findOneOptions: unknown;
    const findOne = async (_query: Record<string, unknown>, options?: unknown) => {
      findOneOptions = options;
      return {
        _id: 'declared-1',
        modelOptions: { indexes: [{ fields: ['keep'], name: 'keep_me' }] },
      };
    };
    const findByIdAndUpdate = async () => ({});
    const originalSchema = {
      modelOptions: { indexes: [] as { fields: string[]; name?: string }[] },
    };
    const persisted = await persistDeclaredSchemaIndexes({
      declaredSchemaModel: { findOne, findByIdAndUpdate },
      schemaName: 'User',
      originalSchema,
      applied: [{ fields: ['email'], name: 'cnd_idx_email_asc' }],
    });
    expect(persisted).toBe(true);
    expect(findOneOptions).toEqual({ readPreference: 'primary' });
    expect(originalSchema.modelOptions.indexes.map(index => index.name)).toEqual([
      'keep_me',
      'cnd_idx_email_asc',
    ]);
  });

  it('reuses a live name-conflict only when identity matches', () => {
    const live = [
      {
        name: 'user_idx',
        fields: ['email'],
        options: { name: 'user_idx', unique: false },
      },
    ];
    expect(
      liveNameConflictAllowsReuse(
        { name: 'user_idx', fields: ['email'], options: { name: 'user_idx' } },
        live,
      ),
    ).toBe(true);
    expect(
      liveNameConflictAllowsReuse(
        { name: 'user_idx', fields: ['username'], options: { name: 'user_idx' } },
        live,
      ),
    ).toBe(false);
    expect(
      liveNameConflictAllowsReuse(
        {
          name: 'user_idx',
          fields: ['email'],
          options: { name: 'user_idx', unique: true },
        },
        live,
      ),
    ).toBe(false);
    expect(
      liveNameConflictAllowsReuse(
        { name: 'user_idx', fields: ['email'], options: { name: 'user_idx' } },
        [],
      ),
    ).toBe(false);
  });

  it('allows dialect-native types and rejects foreign leftovers', () => {
    expect(sqlDialectAllowsIndexType('mysql', CompatibleIndexType.Ascending)).toBe(true);
    expect(sqlDialectAllowsIndexType('mariadb', CompatibleIndexType.Descending)).toBe(
      true,
    );
    expect(sqlDialectAllowsIndexType('sqlite', PostgresIndexType.BTREE)).toBe(true);
    expect(sqlDialectAllowsIndexType('sqlite', PostgresIndexType.HASH)).toBe(false);
    expect(sqlDialectAllowsIndexType('mysql', PostgresIndexType.GIST)).toBe(false);
    expect(sqlDialectAllowsIndexType('postgres', PostgresIndexType.GIN)).toBe(true);
    expect(mongoAllowsIndexType(CompatibleIndexType.Ascending)).toBe(true);
    expect(mongoAllowsIndexType(PostgresIndexType.BTREE)).toBe(false);
  });

  it('adopts a live old global name and generates a table-qualified name when unmatched', () => {
    const adopted = bindDeclaredIndexesToLive(
      [{ fields: ['resource'], types: [CompatibleIndexType.Ascending] }],
      [
        {
          name: 'cnd_idx_resource_asc',
          fields: ['resource'],
          options: { name: 'cnd_idx_resource_asc', unique: false },
        },
      ],
      'cnd_Permission',
    );
    expect(resolveIndexName(adopted[0])).toBe('cnd_idx_resource_asc');
    const generated = bindDeclaredIndexesToLive(
      [{ fields: ['resource'], types: [CompatibleIndexType.Ascending] }],
      [],
      'cnd_Relationship',
    );
    expect(resolveIndexName(generated[0])).toBe('cnd_idx_cnd_Relationship_resource_asc');
  });

  it('does not treat a missing-ns Mongo error as a live name conflict', () => {
    expect(
      isMongoNamespaceMissingError({
        code: 26,
        codeName: 'NamespaceNotFound',
        message: 'ns does not exist: test.cnd_adminapitokens',
      }),
    ).toBe(true);
    expect(isMongoNamespaceMissingError({ message: 'unauthorized' })).toBe(false);
  });

  it('reports unsupported SQL JSON and extracted-relation indexes', () => {
    expect(
      sqlIndexUnsupportedReason(
        'mysql',
        { fields: ['inheritanceTree'] },
        { inheritanceTree: { type: [TYPE.String] } },
      ),
    ).toMatch(/MySQL JSON field 'inheritanceTree'/);
    expect(
      sqlIndexUnsupportedReason(
        'postgres',
        { fields: ['inheritanceTree'] },
        { inheritanceTree: { type: [TYPE.String] } },
      ),
    ).toBeUndefined();
    expect(
      sqlIndexUnsupportedReason(
        'postgres',
        { fields: ['participants'] },
        {
          participants: [{ type: TYPE.Relation, model: 'User' }],
        },
      ),
    ).toMatch(/relation join table/);
    expect(
      sqlIndexUnsupportedReason(
        'postgres',
        { fields: ['room', 'createdAt'] },
        {
          room: { type: TYPE.Relation, model: 'ChatRoom' },
          createdAt: { type: TYPE.Date },
        },
        { timestamps: true },
      ),
    ).toBeUndefined();
    expect(
      sqlIndexUnsupportedReason(
        'mysql',
        { fields: ['email'] },
        { email: { type: TYPE.String } },
      ),
    ).toBeUndefined();
  });

  it('maps declared scalar relations to engine *Id and never Authz String *Id fields', () => {
    const fields = collectSchemaIndexFields({
      fields: {
        room: { type: TYPE.Relation, model: 'ChatRoom' },
        createdAt: { type: TYPE.Date },
        resource: { type: TYPE.String },
        resourceId: { type: TYPE.String },
        subject: { type: TYPE.String },
        subjectId: { type: TYPE.String },
      },
    });
    expect(sqlEngineIndexFieldName('room', fields)).toBe('roomId');
    expect(sqlDeclaredIndexFieldName('roomId', fields)).toBe('room');
    expect(sqlEngineIndexFieldName('resource', fields)).toBe('resource');
    expect(sqlEngineIndexFieldName('resourceId', fields)).toBe('resourceId');
    expect(sqlDeclaredIndexFieldName('resourceId', fields)).toBe('resourceId');
    expect(sqlDeclaredIndexFieldName('subjectId', fields)).toBe('subjectId');
    expect(mapIndexFieldsToSqlEngine({ fields: ['room', 'createdAt'] }, fields)).toEqual([
      'roomId',
      'createdAt',
    ]);
    expect(mapIndexFieldsToDeclared({ fields: ['roomId', 'createdAt'] }, fields)).toEqual(
      ['room', 'createdAt'],
    );
    expect(
      canonicalizeDeclaredIndexFields({ fields: ['roomId', 'createdAt'] }, fields).fields,
    ).toEqual(['room', 'createdAt']);
    expect(
      canonicalizeDeclaredIndexFields({ fields: ['resourceId'] }, fields).fields,
    ).toEqual(['resourceId']);
  });

  it('generates index names from declared fields, not engine *Id columns', () => {
    expect(
      generateIndexName(
        ['room', 'createdAt'],
        [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        false,
        'cnd_ChatMessage',
      ),
    ).toBe('cnd_idx_cnd_ChatMessage_room_createdAt_asc_asc');
    expect(
      generateIndexName(
        ['roomId', 'createdAt'],
        [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        false,
        'cnd_ChatMessage',
      ),
    ).not.toBe('cnd_idx_cnd_ChatMessage_room_createdAt_asc_asc');
  });

  it('binds live engine roomId to declared room without renaming Authz String *Id', () => {
    const fields = {
      room: { type: TYPE.Relation, model: 'ChatRoom' },
      createdAt: { type: TYPE.Date },
      resource: { type: TYPE.String },
      resourceId: { type: TYPE.String },
    };
    const normalize = sqlIndexFieldNormalizer(fields);
    const bound = bindDeclaredIndexesToLive(
      [
        {
          fields: ['room', 'createdAt'],
          types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        },
      ],
      [
        {
          name: 'roomId_createdAt',
          fields: ['roomId', 'createdAt'],
          options: { name: 'roomId_createdAt', unique: false },
        },
      ],
      'cnd_ChatMessage',
      normalize,
    );
    expect(resolveIndexName(bound[0])).toBe('roomId_createdAt');
    expect(bound[0].fields).toEqual(['room', 'createdAt']);
    expect(indexIdentity(bound[0])).toEqual({
      fields: ['room', 'createdAt'],
      unique: false,
    });

    const authz = bindDeclaredIndexesToLive(
      [{ fields: ['resource'], types: [CompatibleIndexType.Ascending] }],
      [
        {
          name: 'cnd_idx_cnd_Permission_resource_asc',
          fields: ['resource'],
          options: { name: 'cnd_idx_cnd_Permission_resource_asc', unique: false },
        },
      ],
      'cnd_Permission',
      normalize,
    );
    expect(resolveIndexName(authz[0])).toBe('cnd_idx_cnd_Permission_resource_asc');
    expect(authz[0].fields).toEqual(['resource']);
  });
});
