import { ConduitModel, ConduitModelOptions } from '../interfaces';
import { ConduitSchema } from './ConduitSchema';
import { DatabaseProvider } from '../modules';

export class ConduitActiveSchema<T> extends ConduitSchema {
  private readonly dbInstance: DatabaseProvider;

  constructor(
    dbInstance: DatabaseProvider,
    name: string,
    fields?: ConduitModel,
    modelOptions?: ConduitModelOptions,
    collectionName?: string
  ) {
    super(name, fields ?? {}, modelOptions, collectionName);
    this.dbInstance = dbInstance;
  }

  findOne(
    query: { [key: string]: any },
    select?: string,
    populate?: string | string[]
  ): Promise<T | null> {
    return this.dbInstance.findOne<T>(this.name, query, select, populate);
  }

  findMany(
    query: { [key: string]: any },
    select?: string,
    skip?: number,
    limit?: number,
    sort?: { [key: string]: number } | string[],
    populate?: string | string[]
  ): Promise<T[]> {
    return this.dbInstance.findMany<T>(
      this.name,
      query,
      select,
      skip,
      limit,
      sort,
      populate
    );
  }

  create(query: { [key: string]: any }): Promise<T> {
    return this.dbInstance.create<T>(this.name, query);
  }

  createMany(query: { [key: string]: any }): Promise<T[]> {
    return this.dbInstance.findOne<T>(this.name, query);
  }

  findByIdAndUpdate(
    id: string,
    document: { [key: string]: any },
    updateProvidedOnly?: boolean
  ): Promise<T | null> {
    return this.dbInstance.findByIdAndUpdate<T>(
      this.name,
      id,
      document,
      updateProvidedOnly
    );
  }

  updateMany(
    filterQuery: { [key: string]: any },
    query: { [key: string]: any },
    updateProvidedOnly?: boolean
  ) {
    return this.dbInstance.updateMany(this.name, filterQuery, query, updateProvidedOnly);
  }

  deleteOne(query: { [key: string]: any }) {
    return this.dbInstance.deleteOne(this.name, query);
  }

  deleteMany(query: { [key: string]: any }) {
    return this.dbInstance.deleteMany(this.name, query);
  }

  countDocuments(query: { [key: string]: any }): Promise<number> {
    return this.dbInstance.countDocuments(this.name, query);
  }
}
