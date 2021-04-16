import { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';

export interface SchemaAdapter {
  /**
   * The actual underlying model
   */
  model: any;
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
  findOne(query: any, select?: string, populate?: string[], relations?: any): Promise<any>;

  /**
   * Should find Many
   * @param query
   * @param skip
   * @param limit
   * @param select
   * @param sort
   */
  findMany(
    query: any,
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
  create(query: any): Promise<any>;

  createMany(query: any): Promise<any>;

  deleteOne(query: any): Promise<any>;

  deleteMany(query: any): Promise<any>;

  findByIdAndUpdate(id: any, document: any): Promise<any>;

  updateMany(filterQuery: any, query: any): Promise<any>;

  countDocuments(query: any): Promise<number>;
}
