import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  chunkSchemaNameForProfile,
  chunkSchemaPostgresRelations,
  conduitPhysicalCollectionName,
  legacyChunkSchemaNameForProfile,
  postgresQuotedIdentifier,
  sequelizeUnderscore,
} from '../dist-test/utils/genericSource.js';

const require = createRequire(import.meta.url);
const profile = {
  provider: 'openai-compatible',
  modelName: 'text-embedding-3-small',
  dimensions: 1536,
  similarity: 'cosine',
};

test('legacy PostgreSQL names collide after fold/truncation; compact names do not', () => {
  const legacyTable = conduitPhysicalCollectionName(
    legacyChunkSchemaNameForProfile(profile),
  );
  assert.equal(
    postgresQuotedIdentifier(sequelizeUnderscore(`${legacyTable}_documentId_chunkKey`)),
    postgresQuotedIdentifier(
      sequelizeUnderscore(`${legacyTable}_partitionSubject_sourceId`),
    ),
  );

  const compactRelations = chunkSchemaPostgresRelations(
    chunkSchemaNameForProfile(profile),
  );
  const sequelizeNames = compactRelations.map(name =>
    postgresQuotedIdentifier(sequelizeUnderscore(name)),
  );
  assert.equal(new Set(sequelizeNames).size, sequelizeNames.length);
  assert.equal(
    sequelizeNames.every(name => Buffer.byteLength(name) <= 63),
    true,
  );
});

test('live pgvector create reproduces the collision only for legacy names', async t => {
  const url = process.env.EMBEDDINGS_PG_REPRO_URL;
  if (!url) {
    t.skip('set EMBEDDINGS_PG_REPRO_URL to run the live PostgreSQL reproduction');
    return;
  }
  let Sequelize;
  let DataTypes;
  try {
    ({ Sequelize, DataTypes } = require('../../database/node_modules/sequelize'));
  } catch {
    ({ Sequelize, DataTypes } = require('sequelize'));
  }
  const sequelize = new Sequelize(url, { logging: false });
  const legacyTable = conduitPhysicalCollectionName(
    legacyChunkSchemaNameForProfile(profile),
  );
  const compactTable = conduitPhysicalCollectionName(
    chunkSchemaNameForProfile(profile),
  );
  const defineModel = tableName =>
    sequelize.define(
      tableName,
      {
        _id: { type: DataTypes.UUID, primaryKey: true },
        documentId: DataTypes.STRING,
        chunkKey: DataTypes.STRING,
        partitionSubject: DataTypes.STRING,
        sourceId: DataTypes.STRING,
        mimeType: DataTypes.STRING,
        status: DataTypes.STRING,
      },
      {
        freezeTableName: true,
        timestamps: true,
        indexes: [
          { unique: true, fields: ['documentId', 'chunkKey'] },
          { fields: ['partitionSubject', 'sourceId'] },
          { fields: ['sourceId', 'documentId'] },
          { fields: ['mimeType', 'status'] },
        ],
      },
    );
  const dropLeftovers = async () => {
    await sequelize.query(
      `DO $$ DECLARE r record;
       BEGIN
         FOR r IN SELECT tablename FROM pg_tables
           WHERE schemaname = 'public'
             AND (tablename ILIKE '%embeddingchunk%'
               OR tablename ILIKE '%embedding_chunk%'
               OR tablename LIKE 'cnd\\_ec\\_%')
         LOOP
           EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', r.tablename);
         END LOOP;
       END $$;`,
    );
  };
  try {
    await dropLeftovers();
    await assert.rejects(() => defineModel(legacyTable).sync(), /already exists/);
    await defineModel(compactTable).sync();
  } finally {
    await dropLeftovers();
    await sequelize.close();
  }
});
