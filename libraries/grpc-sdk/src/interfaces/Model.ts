export enum TYPE {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  ObjectId = 'ObjectId',
  JSON = 'JSON',
  Relation = 'Relation',
}

export enum SQLDataType {
  VARCHAR = 'VARCHAR',
  TEXT = 'TEXT',
  CHAR = 'CHAR',
  INT = 'INT',
  BIGINT = 'BIGINT',
  FLOAT = 'FLOAT',
  DOUBLE = 'DOUBLE',
  DECIMAL = 'DECIMAL',
  TIME = 'TIME',
  DATETIME = 'DATETIME',
  TIMESTAMP = 'TIMESTAMP',
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

type BaseConduitModelField = {
  type?: TYPE | TYPE[] | ConduitModel | ArrayConduitModel[];
  sqlType?: SQLDataType;
  default?: any;
  description?: string;
  required?: boolean;
  select?: boolean;
};

type UniqueAndRequiredField = {
  unique: true;
  required: true;
  index?: SchemaFieldIndex;
};

type NotUniqueField = {
  unique?: false;
  required?: boolean;
  index?: SchemaFieldIndex;
};

export type BasicConduitModelField = BaseConduitModelField &
  (UniqueAndRequiredField | NotUniqueField);

export type ConduitModelFieldRelation = BasicConduitModelField & {
  type: TYPE.Relation | TYPE.Relation[];
  model: string;
};

export type ConduitModelFieldJSON = BasicConduitModelField & {
  type: TYPE.JSON | TYPE.JSON[];
};

export type ConduitModelFieldEnum = BasicConduitModelField & {
  type: ExcludeJSONRelation<TYPE> | ExcludeJSONRelation<TYPE>[];
  enum: any;
};

export type ConduitModelField = BasicConduitModelField & {
  type?:
    | ExcludeJSONRelation<TYPE>
    | ExcludeJSONRelation<TYPE>[]
    | ConduitModel
    | ArrayConduitModel[];
};

export type allowedTypes =
  | ExcludeRelation<TYPE>
  | ConduitModelField
  | ConduitModelFieldEnum
  | ConduitModelFieldJSON
  | ConduitModelFieldRelation;

type embeddableArray =
  | ExcludeRelation<TYPE>
  | ConduitModelField
  | ConduitModelFieldEnum
  | ConduitModelFieldJSON;

type ExcludeRelation<T> = T extends TYPE.Relation ? never : T;
type ExcludeJSON<T> = T extends TYPE.JSON ? never : T;
type ExcludeJSONRelation<T> = ExcludeJSON<ExcludeRelation<T>>;

export type ArrayConduitModel = {
  // block special keywords
  type?: never;
  sqlType?: never;
  default?: never;
  description?: never;
  required?: never;
  select?: never;
  unique?: never;
  index?: never;
  enum?: never;
  model?: never;
} & {
  [field in string]: embeddableArray | embeddableArray[];
};
export type ConduitModel = {
  // block special keywords
  type?: never;
  sqlType?: never;
  default?: never;
  description?: never;
  required?: never;
  select?: never;
  unique?: never;
  index?: never;
  enum?: never;
  model?: never;
} & {
  [field in string]: allowedTypes | allowedTypes[] | ConduitModel;
};

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
    authorization?: {
      enabled: boolean;
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
  where?: {
    [opt: string]: any;
  };
}
