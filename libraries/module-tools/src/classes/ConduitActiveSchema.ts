import {
  AuthzOptions,
  ConduitModel,
  ConduitSchema,
  ConduitSchemaOptions,
  CountDocumentsOptions,
  DatabaseProvider,
  DatabaseOperations,
  FindManyOptions,
  FindOneOptions,
  PopulateAuthzOptions,
  Query,
} from '@conduitplatform/grpc-sdk';

/**
 * Pass what `database.withTransaction` or `database.withOptionalTransaction` hands
 * to its callback, to run a call as part of that unit of work.
 */
type InTransaction<O> = O & { transaction?: DatabaseOperations };

function splitTransaction<O>(
  options?: InTransaction<O>,
): [DatabaseOperations | undefined, O | undefined] {
  if (!options?.transaction) return [undefined, options];
  const { transaction, ...rest } = options;
  return [transaction, rest as O];
}

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

  findOne(query: Query<T>, options?: InTransaction<FindOneOptions>): Promise<T | null> {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).findOne<T>(this.name, query, rest);
  }

  findMany(query: Query<T>, options?: InTransaction<FindManyOptions>): Promise<T[]> {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).findMany<T>(this.name, query, rest);
  }

  create(query: Query<T>, options?: InTransaction<AuthzOptions>): Promise<T> {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).create<T>(this.name, query, rest);
  }

  createMany(query: Query<T>[], options?: InTransaction<AuthzOptions>): Promise<T[]> {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).createMany<T>(this.name, query, rest);
  }

  findByIdAndUpdate(
    id: string,
    document: Query<T>,
    options?: InTransaction<PopulateAuthzOptions>,
  ): Promise<T | null> {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).findByIdAndUpdate<T>(
      this.name,
      id,
      document,
      rest,
    );
  }

  findByIdAndReplace(
    id: string,
    document: Query<T>,
    options?: InTransaction<PopulateAuthzOptions>,
  ): Promise<T | null> {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).findByIdAndReplace<T>(
      this.name,
      id,
      document,
      rest,
    );
  }

  replaceOne(
    filterQuery: Query<T>,
    query: Query<T>,
    options?: InTransaction<PopulateAuthzOptions>,
  ) {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).replaceOne(
      this.name,
      filterQuery,
      query,
      rest,
    );
  }

  updateOne(
    filterQuery: Query<T>,
    query: Query<T>,
    options?: InTransaction<PopulateAuthzOptions>,
  ) {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).updateOne(
      this.name,
      filterQuery,
      query,
      rest,
    );
  }

  updateMany(
    filterQuery: Query<T>,
    query: Query<T>,
    options?: InTransaction<PopulateAuthzOptions>,
  ) {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).updateMany(
      this.name,
      filterQuery,
      query,
      rest,
    );
  }

  deleteOne(query: Query<T>, options?: InTransaction<AuthzOptions>) {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).deleteOne(this.name, query, rest);
  }

  deleteMany(query: Query<T>, options?: InTransaction<AuthzOptions>) {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).deleteMany(this.name, query, rest);
  }

  countDocuments(
    query: Query<T>,
    options?: InTransaction<CountDocumentsOptions>,
  ): Promise<number> {
    const [transaction, rest] = splitTransaction(options);
    return (transaction ?? this.dbInstance).countDocuments(this.name, query, rest);
  }
}
