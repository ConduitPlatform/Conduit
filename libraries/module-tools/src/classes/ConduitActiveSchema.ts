import {
  ConduitModel,
  ConduitSchema,
  ConduitSchemaOptions,
  DatabaseProvider,
  FindManyOptions,
  FindOneOptions,
  Query,
} from '@conduitplatform/grpc-sdk';

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

  findOne(query: Query<T>, options: FindOneOptions): Promise<T | null>;

  findOne(
    query: Query<T>,
    select?: string,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T | null>;

  findOne(
    query: Query<T>,
    selectOrOptions?: string | FindOneOptions,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T | null> {
    if (
      typeof selectOrOptions === 'object' &&
      selectOrOptions !== null &&
      !Array.isArray(selectOrOptions)
    ) {
      return this.dbInstance.findOne<T>(this.name, query, selectOrOptions);
    }
    return this.dbInstance.findOne<T>(
      this.name,
      query,
      selectOrOptions,
      populate,
      userId,
      scope,
    );
  }

  findMany(query: Query<T>, options: FindManyOptions): Promise<T[]>;

  findMany(
    query: Query<T>,
    select?: string,
    skip?: number,
    limit?: number,
    sort?: { [field: string]: -1 | 1 } | string[] | string,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T[]>;

  findMany(
    query: Query<T>,
    selectOrOptions?: string | FindManyOptions,
    skip?: number,
    limit?: number,
    sort?: { [field: string]: -1 | 1 } | string[] | string,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T[]> {
    if (
      typeof selectOrOptions === 'object' &&
      selectOrOptions !== null &&
      !Array.isArray(selectOrOptions)
    ) {
      return this.dbInstance.findMany<T>(this.name, query, selectOrOptions);
    }
    return this.dbInstance.findMany<T>(
      this.name,
      query,
      selectOrOptions,
      skip,
      limit,
      sort,
      populate,
      userId,
      scope,
    );
  }

  create(query: Query<T>, userId?: string, scope?: string): Promise<T> {
    return this.dbInstance.create<T>(this.name, query, userId, scope);
  }

  createMany(query: Query<T>[], userId?: string, scope?: string): Promise<T[]> {
    return this.dbInstance.createMany<T>(this.name, query, userId, scope);
  }

  findByIdAndUpdate(
    id: string,
    document: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T | null> {
    return this.dbInstance.findByIdAndUpdate<T>(
      this.name,
      id,
      document,
      populate,
      userId,
      scope,
    );
  }

  findByIdAndReplace(
    id: string,
    document: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T | null> {
    return this.dbInstance.findByIdAndReplace<T>(
      this.name,
      id,
      document,
      populate,
      userId,
      scope,
    );
  }

  replaceOne(
    filterQuery: Query<T>,
    query: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ) {
    return this.dbInstance.replaceOne(
      this.name,
      filterQuery,
      query,
      populate,
      userId,
      scope,
    );
  }

  updateOne(
    filterQuery: Query<T>,
    query: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ) {
    return this.dbInstance.updateOne(
      this.name,
      filterQuery,
      query,
      populate,
      userId,
      scope,
    );
  }

  updateMany(
    filterQuery: Query<T>,
    query: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ) {
    return this.dbInstance.updateMany(
      this.name,
      filterQuery,
      query,
      populate,
      userId,
      scope,
    );
  }

  deleteOne(query: Query<T>, userId?: string, scope?: string) {
    return this.dbInstance.deleteOne(this.name, query, userId, scope);
  }

  deleteMany(query: Query<T>, userId?: string, scope?: string) {
    return this.dbInstance.deleteMany(this.name, query, userId, scope);
  }

  countDocuments(
    query: Query<T>,
    options: { userId?: string; scope?: string; readPreference?: string },
  ): Promise<number>;

  countDocuments(query: Query<T>, userId?: string, scope?: string): Promise<number>;

  countDocuments(
    query: Query<T>,
    userIdOrOptions?:
      | string
      | { userId?: string; scope?: string; readPreference?: string },
    scope?: string,
  ): Promise<number> {
    if (typeof userIdOrOptions === 'object' && userIdOrOptions !== null) {
      return this.dbInstance.countDocuments(this.name, query, userIdOrOptions);
    }
    return this.dbInstance.countDocuments(this.name, query, userIdOrOptions, scope);
  }
}
