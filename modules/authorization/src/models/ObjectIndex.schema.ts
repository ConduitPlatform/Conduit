import {
  ConduitModel,
  ConduitSchemaOptions,
  DatabaseProvider,
  MongoIndexType,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitActiveSchema } from '@conduitplatform/module-tools';

/**
 * This is used to model a relation tuple like:
 * user:2131cdad reader token:123aDSA
 */
const schema: ConduitModel = {
  _id: TYPE.ObjectId,
  /**
   * {
   *   "organization:123123#view": "organization:123123#member"
   *   "organization:123123#view": "organization:123124#member"
   * }
   */
  subject: {
    type: TYPE.String,
    required: true,
    index: {
      type: MongoIndexType.Ascending,
    },
  },
  subjectId: {
    type: TYPE.String,
    required: true,
    default: '',
  },
  // organization
  subjectType: {
    type: TYPE.String,
    required: true,
    default: '',
  },
  // view
  subjectPermission: {
    type: TYPE.String,
    required: true,
    default: '',
  },
  entity: {
    type: TYPE.String,
    required: true,
    index: {
      type: MongoIndexType.Ascending,
    },
  },
  entityId: {
    type: TYPE.String,
    default: '',
    required: true,
  },
  // organization
  entityType: {
    type: TYPE.String,
    required: true,
    default: '',
  },
  entityPermission: {
    type: TYPE.String,
    default: '',
  },
  // member
  relation: {
    type: TYPE.String,
    required: true,
    default: '',
  },
  inheritanceTree: {
    type: [TYPE.String],
    default: [],
    index: {
      type: MongoIndexType.Ascending,
    },
  },
  // objectIndexRowKey(row); unique. No default: rows written before it existed stay
  // unset (excluded from the unique index) until the startup migration fills them.
  key: {
    type: TYPE.String,
  },
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
};
const schemaOptions: ConduitSchemaOptions = {
  timestamps: true,
  indexes: [
    {
      fields: ['subjectType', 'subjectPermission', 'entity'],
    },
    {
      fields: ['entity', 'subjectType', 'subjectPermission'],
    },
    {
      // `_id` last: the connection job pages children by `_id` within one
      // (entityType, entityId, entityPermission), so the scan is index-ordered.
      fields: ['entityType', 'entityId', 'entityPermission', '_id'],
    },
  ],
  conduit: {
    permissions: {
      extendable: false,
      canCreate: false,
      canModify: 'Nothing',
      canDelete: false,
    },
  },
};
const collectionName = undefined;

/**
 * Adds the unique index on `key`. The options differ per database: Mongo indexes a
 * missing field as null, so it needs `sparse` to skip rows not yet backfilled; SQL
 * unique indexes already treat NULLs as distinct (and reject Mongo-only options).
 * Call before registering the schema.
 */
export function addObjectIndexKeyIndex(databaseType: string) {
  schemaOptions.indexes = (schemaOptions.indexes ?? []).filter(
    index => !(index.fields.length === 1 && index.fields[0] === 'key'),
  );
  schemaOptions.indexes.push(
    databaseType === 'MongoDB'
      ? {
          fields: ['key'],
          // `types` is required here: older database modules crash converting a
          // single-field Mongo index that has options but no types.
          types: [MongoIndexType.Ascending],
          options: { unique: true, sparse: true },
        }
      : { fields: ['key'], options: { unique: true } },
  );
}

export class ObjectIndex extends ConduitActiveSchema<ObjectIndex> {
  private static _instance: ObjectIndex;
  _id: string;
  subject: string;
  subjectId: string;
  subjectType: string;
  subjectPermission: string;
  entity: string;
  entityId: string;
  entityType: string;
  entityPermission: string;
  inheritanceTree: string[];
  relation: string;
  key: string;
  createdAt: Date;
  updatedAt: Date;

  private constructor(database: DatabaseProvider) {
    super(database, ObjectIndex.name, schema, schemaOptions, collectionName);
  }

  static getInstance(database?: DatabaseProvider) {
    if (ObjectIndex._instance) return ObjectIndex._instance;
    if (!database) {
      throw new Error('No database instance provided!');
    }
    ObjectIndex._instance = new ObjectIndex(database);
    return ObjectIndex._instance;
  }
}
