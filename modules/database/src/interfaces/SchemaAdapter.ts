import { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export type SingleDocQuery = string | Indexable;
export type MultiDocQuery = string | [Indexable];
export type Query = SingleDocQuery | MultiDocQuery;
export type ParsedQuery = Indexable;
export type Doc = ParsedQuery;
export type Fields = ParsedQuery;
export type Schema = MongooseSchema | SequelizeSchema;

export interface SchemaAdapter<T> {
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

  /**
   * Should find one
   * @param query
   * @param select
   * @param populate
   * @param relations
   */
  findOne(query: Query, select?: string, populate?: string[]): Promise<any>;

  /**
   * Should find Many
   * @param query
   * @param skip
   * @param limit
   * @param select
   * @param sort
   * @param relations
   * @param populate
   */
  findMany(
    query: Query,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: any,
    populate?: string[],
  ): Promise<any>;

  /**
   * Should create
   * @param query
   */
  create(query: SingleDocQuery): Promise<any>;

  createMany(query: MultiDocQuery): Promise<any>;

  deleteOne(query: Query): Promise<any>;

  deleteMany(query: Query): Promise<any>;

  findByIdAndUpdate(id: any, document: SingleDocQuery, populate?: string[]): Promise<any>;

  updateMany(
    filterQuery: Query,
    query: SingleDocQuery,
    populate?: string[],
  ): Promise<any>;

  countDocuments(query: Query): Promise<number>;
}
