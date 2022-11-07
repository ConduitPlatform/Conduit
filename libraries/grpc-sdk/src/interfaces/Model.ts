import { WhereOptions } from 'sequelize';

export enum TYPE {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  ObjectId = 'ObjectId',
  JSON = 'JSON',
  Relation = 'Relation',
}

export enum MongoIndexType {
  Ascending = 1,
  Descending = -1,
  GeoSpatial2d = '2d',
  GeoSpatial2dSphere = '2dsphere',
  GeoHaystack = 'geoHaystack',
  Hashed = 'hashed',
  Text = 'text',
}

export enum PostgresIndexType {
  BTREE = 'BTREE',
  HASH = 'HASH',
  GIST = 'GIST',
  SPGIST = 'SPGIST',
  GIN = 'GIN',
  BRIN = 'BRIN',
}

export type Array = any[];

export interface ConduitModelField {
  type?: TYPE | Array | ConduitModel | ConduitModelField;
  enum?: any;
  default?: any;
  model?: string;
  unique?: boolean;
  select?: boolean;
  required?: boolean;
  systemRequired?: boolean;
  index?: SchemaFieldIndex;
}

export interface ConduitModel {
  [field: string]:
    | ConduitModelField
    | ConduitModelField[]
    | ConduitModel
    | TYPE
    | TYPE[]
    | any[]; // removing this caused multiple issues
}

export const ConduitModelOptionsPermModifyType = [
  'Everything',
  'Nothing',
  'ExtensionOnly',
];

export interface ConduitSchemaOptions {
  timestamps?: boolean;
  _id?: boolean;
  conduit?: {
    [field: string]: any;
    permissions?: {
      extendable: boolean;
      canCreate: boolean;
      canModify: 'Everything' | 'Nothing' | 'ExtensionOnly';
      canDelete: boolean;
    };
  };
  indexes?: ModelOptionsIndexes[];
}

export interface SchemaFieldIndex {
  type?: MongoIndexType | PostgresIndexType;
  options?: MongoIndexOptions | PostgresIndexOptions;
  [field: string]: any;
}

export interface ModelOptionsIndexes {
  fields: string[];
  types?: MongoIndexType[] | PostgresIndexType;
  options?: MongoIndexOptions | PostgresIndexOptions;
  [field: string]: any;
}

export interface MongoIndexOptions {
  background?: boolean;
  unique?: boolean;
  name?: string;
  partialFilterExpression?: Document;
  sparse?: boolean;
  expireAfterSeconds?: number;
  storageEngine?: Document;
  commitQuorum?: number | string;
  version?: number;
  weights?: Document;
  default_language?: string;
  language_override?: string;
  textIndexVersion?: number;
  '2dsphereIndexVersion'?: number;
  bits?: number;
  min?: number;
  max?: number;
  bucketSize?: number;
  wildcardProjection?: Document;
  hidden?: boolean;
}

export interface PostgresIndexOptions {
  concurrently?: boolean;
  name?: string;
  operator?: string;
  parser?: null | string;
  prefix?: string;
  unique?: boolean;
  using?: PostgresIndexType;
  where?: WhereOptions;
}
