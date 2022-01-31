import { ConduitSchema } from '@conduitplatform/conduit-grpc-sdk';

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
    query: string,
    select?: string,
    populate?: string[],
    relations?: any
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
    query: string,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: any,
    populate?: string[],
    relations?: any
  ): Promise<any>;

  /**
   * Should create
   * @param query
   */
  create(query: string): Promise<any>;

  createMany(query: string): Promise<any>;

  deleteOne(query: string): Promise<any>;

  deleteMany(query: string): Promise<any>;

  findByIdAndUpdate(
    id: any,
    document: string,
    updateProvidedOnly?: boolean,
    populate?: string[],
    relations?: any
  ): Promise<any>;

  updateMany(
    filterQuery: string,
    query: string,
    updateProvidedOnly?: boolean
  ): Promise<any>;

  countDocuments(query: string): Promise<number>;
}
