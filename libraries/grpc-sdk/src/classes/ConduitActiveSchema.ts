import { ConduitModel, ConduitSchemaOptions } from '../interfaces';
import { ConduitSchema } from './ConduitSchema';
import { DatabaseProvider } from '../modules';
import { Query } from '../types/db';

export class ConduitActiveSchema<T> extends ConduitSchema {
  private readonly dbInstance: DatabaseProvider;

  constructor(
    dbInstance: DatabaseProvider,
    name: string,
    fields?: ConduitModel,
    modelOptions?: ConduitSchemaOptions,
    collectionName?: string,
  ) {
    super(name, fields ?? {}, modelOptions, collectionName);
    this.dbInstance = dbInstance;
  }

  findOne(
    query: Query<T>,
    select?: string,
    populate?: string | string[],
  ): Promise<T | null> {
    return this.dbInstance.findOne<T>(this.name, query, select, populate);
  }

  findMany(
    query: Query<T>,
    select?: string,
    skip?: -1 | 1,
    limit?: number,
    sort?: { [field: string]: -1 | 1 } | string[] | string,
    populate?: string | string[],
  ): Promise<T[]> {
    return this.dbInstance.findMany<T>(
      this.name,
      query,
      select,
      skip,
      limit,
      sort,
      populate,
    );
  }

  create(query: Query<T>): Promise<T> {
    return this.dbInstance.create<T>(this.name, query);
  }

  createMany(query: Query<T>): Promise<T[]> {
    return this.dbInstance.createMany<T>(this.name, query);
  }

  findByIdAndUpdate(
    id: string,
    document: Query<T>,
    populate?: string | string[],
  ): Promise<T | null> {
    return this.dbInstance.findByIdAndUpdate<T>(this.name, id, document, populate);
  }

  updateMany(filterQuery: Query<T>, query: Query<T>, populate?: string | string[]) {
    return this.dbInstance.updateMany(this.name, filterQuery, query, populate);
  }

  deleteOne(query: Query<T>) {
    return this.dbInstance.deleteOne(this.name, query);
  }

  deleteMany(query: Query<T>) {
    return this.dbInstance.deleteMany(this.name, query);
  }

  countDocuments(query: Query<T>): Promise<number> {
    return this.dbInstance.countDocuments(this.name, query);
  }
}
