import { describe, expect, it } from '@jest/globals';
import { TYPE } from '@conduitplatform/grpc-sdk';
import mongoose from 'mongoose';
import { parseQuery } from '../../sequelize-adapter/parser/index.js';
import { parseSelectFields } from '../embeddingsJobContext.js';
import { mongoVectorProjection, postgresVectorSelectList } from '../vectorProjection.js';

const STORAGE_FILE_LIST_SELECT =
  '_id name container folder mimeType size uploadStatus contentVersion';
const STORAGE_FILE_LIST_FIELDS = STORAGE_FILE_LIST_SELECT.split(' ');
const STORAGE_FILE_URL_FIELDS = ['url', 'uri', 'sourceUrl'] as const;

const fileSchemaFields = {
  _id: { type: TYPE.ObjectId },
  name: { type: TYPE.String },
  container: { type: TYPE.String },
  folder: { type: TYPE.String },
  mimeType: { type: TYPE.String },
  size: { type: TYPE.Number },
  uploadStatus: { type: TYPE.String },
  contentVersion: { type: TYPE.String },
  url: { type: TYPE.String },
  uri: { type: TYPE.String },
  sourceUrl: { type: TYPE.String },
};

function mongooseProjection(select: string) {
  const modelName = `StorageFileSelect${Date.now()}${Math.random().toString(36).slice(2)}`;
  const Model = mongoose.model(
    modelName,
    new mongoose.Schema({
      name: String,
      container: String,
      folder: String,
      mimeType: String,
      size: Number,
      uploadStatus: String,
      contentVersion: String,
      url: String,
      uri: String,
      sourceUrl: String,
    }),
  );
  try {
    const query = Model.find({}, select);
    return { ...(query.projection() ?? {}) };
  } finally {
    mongoose.deleteModel(modelName);
  }
}

describe('storage file list select contract', () => {
  it('parses whitespace-separated File fields under Mongo and Postgres planners', () => {
    expect(parseSelectFields(STORAGE_FILE_LIST_SELECT)).toEqual(STORAGE_FILE_LIST_FIELDS);

    const postgres = parseQuery(
      { fields: fileSchemaFields },
      {},
      'postgres',
      {},
      { select: STORAGE_FILE_LIST_SELECT },
      [],
      {},
    );
    expect(postgres.attributes).toEqual(STORAGE_FILE_LIST_FIELDS);

    const mongo = mongooseProjection(STORAGE_FILE_LIST_SELECT);
    expect(Object.keys(mongo).sort()).toEqual(STORAGE_FILE_LIST_FIELDS.sort());
    expect(STORAGE_FILE_LIST_FIELDS.every(field => mongo[field] === 1)).toBe(true);

    const quoted = postgresVectorSelectList(
      fileSchemaFields,
      STORAGE_FILE_LIST_SELECT,
      identifier => `"${identifier}"`,
    );
    for (const field of STORAGE_FILE_LIST_FIELDS) {
      expect(quoted).toContain(`"${field}"`);
    }
    expect(mongoVectorProjection(fileSchemaFields, STORAGE_FILE_LIST_SELECT)).toEqual({
      _id: 1,
      _score: 1,
      name: 1,
      container: 1,
      folder: 1,
      mimeType: 1,
      size: 1,
      uploadStatus: 1,
      contentVersion: 1,
    });
  });

  it('does not select internal File URL fields and does not quote a comma list', () => {
    const fields = parseSelectFields(STORAGE_FILE_LIST_SELECT);
    for (const field of STORAGE_FILE_URL_FIELDS) {
      expect(fields).not.toContain(field);
    }
    expect(mongooseProjection(STORAGE_FILE_LIST_SELECT)).not.toEqual(
      expect.objectContaining({
        url: 1,
        uri: 1,
        sourceUrl: 1,
      }),
    );

    const commaSelect = STORAGE_FILE_LIST_FIELDS.join(',');
    const collapsed = parseQuery(
      { fields: fileSchemaFields },
      {},
      'postgres',
      {},
      { select: commaSelect },
      [],
      {},
    );
    expect(collapsed.attributes).toEqual([commaSelect]);
    expect(parseSelectFields(commaSelect)).toEqual([commaSelect]);
  });
});
