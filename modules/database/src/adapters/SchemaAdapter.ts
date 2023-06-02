import { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import { MongooseSchema } from './mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from './sequelize-adapter/SequelizeSchema';

export type SingleDocQuery = string | Indexable;
export type MultiDocQuery = string | Indexable[];
export type Query = SingleDocQuery | MultiDocQuery;
export type ParsedQuery = Indexable;
export type Doc = ParsedQuery;
export type Fields = ParsedQuery;
export type Schema = MongooseSchema | SequelizeSchema;

export abstract class SchemaAdapter<T> {
  /**
   * The actual underlying model
   */
  model: T;
  /**
   * The original model used to generate this
   */
  originalSchema: ConduitSchema;
  /**
   * A hash of the schema's compiled fields object
   */
  fieldHash: string;

  abstract parseStringToQuery(
    query: Query | SingleDocQuery | MultiDocQuery,
  ): ParsedQuery | ParsedQuery[];

  /**
   * Should find one
   */
  abstract findOne(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
      select?: string;
      populate?: string[];
    },
  ): Promise<any>;

  /**
   * Should find Many
   * @param query
   * @param options
   */
  abstract findMany(
    query: Query,
    options?: {
      skip?: number;
      limit?: number;
      select?: string;
      sort?: any;
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  /**
   * Should create
   * @param query
   * @param options
   */
  abstract create(
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract createMany(
    query: MultiDocQuery,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract deleteOne(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract deleteMany(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ): Promise<any>;

  abstract findByIdAndReplace(
    id: string,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ): Promise<any>;

  abstract replaceOne(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract updateOne(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ): Promise<any>;

  abstract updateMany(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract countDocuments(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<number>;

  abstract columnExistence(columns: string[]): Promise<boolean>;
}
