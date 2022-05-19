import { ConduitSchema } from '@conduitplatform/grpc-sdk';

export type SingleDocQuery = string | { [key: string]: any };
export type MultiDocQuery = string | [{ [key: string]: any }];
export type Query = SingleDocQuery | MultiDocQuery;
export type ParsedQuery = { [key: string]: any };

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
   * Should find one
   * @param query
   * @param select
   * @param populate
   */
  findOne(
    query: Query,
    select?: string,
    populate?: string[],
    relations?: any,
  ): Promise<any>;

  /**
   * Should find Many
   * @param query
   * @param skip
   * @param limit
   * @param select
   * @param sort
   */
  findMany(
    query: Query,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: any,
    populate?: string[],
    relations?: any,
  ): Promise<any>;

  /**
   * Should create
   * @param query
   */
  create(query: SingleDocQuery): Promise<any>;

  createMany(query: MultiDocQuery): Promise<any>;

  deleteOne(query: Query): Promise<any>;

  deleteMany(query: Query): Promise<any>;

  findByIdAndUpdate(
    id: any,
    document: SingleDocQuery,
    updateProvidedOnly?: boolean,
    populate?: string[],
    relations?: any,
  ): Promise<any>;

  updateMany(
    filterQuery: Query,
    query: SingleDocQuery,
    updateProvidedOnly?: boolean,
  ): Promise<any>;

  countDocuments(query: Query): Promise<number>;
}
