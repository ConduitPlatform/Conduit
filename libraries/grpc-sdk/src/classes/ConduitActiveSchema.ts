import { ConduitModel, ConduitSchemaOptions } from '../interfaces';
import { ConduitSchema } from './ConduitSchema';
import { DatabaseProvider } from '../modules';
import { Query } from '../interfaces';

export class ConduitActiveSchema<T> extends ConduitSchema {
  private readonly dbInstance: DatabaseProvider;

  constructor(
    dbInstance: DatabaseProvider,
    name: string,
    fields?: ConduitModel,
    options?: ConduitSchemaOptions,
    collectionName?: string,
  ) {
    super(name, fields ?? {}, options, collectionName);
    this.dbInstance = dbInstance;
  }

  findOne(
    query: Query,
    select?: string,
    populate?: string | string[],
  ): Promise<T | null> {
    return this.dbInstance.findOne<T>(this.name, query, select, populate);
  }

  findMany(
    query: Query,
    select?: string,
    skip?: number,
    limit?: number,
    sort?: { [key: string]: number } | string[],
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

  create(query: Query): Promise<T> {
    return this.dbInstance.create<T>(this.name, query);
  }

  createMany(query: Query): Promise<T[]> {
    return this.dbInstance.createMany<T>(this.name, query);
  }

  findByIdAndUpdate(
    id: string,
    document: Query,
    updateProvidedOnly?: boolean,
    populate?: string | string[],
  ): Promise<T | null> {
    return this.dbInstance.findByIdAndUpdate<T>(
      this.name,
      id,
      document,
      updateProvidedOnly,
      populate,
    );
  }

  updateMany(filterQuery: Query, query: Query, updateProvidedOnly?: boolean) {
    return this.dbInstance.updateMany(this.name, filterQuery, query, updateProvidedOnly);
  }

  deleteOne(query: Query) {
    return this.dbInstance.deleteOne(this.name, query);
  }

  deleteMany(query: Query) {
    return this.dbInstance.deleteMany(this.name, query);
  }

  countDocuments(query: Query): Promise<number> {
    return this.dbInstance.countDocuments(this.name, query);
  }
}
