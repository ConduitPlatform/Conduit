import {
  AuthzOptions,
  ConduitModel,
  ConduitSchema,
  ConduitSchemaOptions,
  CountDocumentsOptions,
  DatabaseProvider,
  FindManyOptions,
  FindOneOptions,
  PopulateAuthzOptions,
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

  findOne(query: Query<T>, options?: FindOneOptions): Promise<T | null> {
    return this.dbInstance.findOne<T>(this.name, query, options);
  }

  findMany(query: Query<T>, options?: FindManyOptions): Promise<T[]> {
    return this.dbInstance.findMany<T>(this.name, query, options);
  }

  create(query: Query<T>, options?: AuthzOptions): Promise<T> {
    return this.dbInstance.create<T>(this.name, query, options);
  }

  createMany(query: Query<T>[], options?: AuthzOptions): Promise<T[]> {
    return this.dbInstance.createMany<T>(this.name, query, options);
  }

  findByIdAndUpdate(
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | null> {
    return this.dbInstance.findByIdAndUpdate<T>(this.name, id, document, options);
  }

  findByIdAndReplace(
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | null> {
    return this.dbInstance.findByIdAndReplace<T>(this.name, id, document, options);
  }

  replaceOne(filterQuery: Query<T>, query: Query<T>, options?: PopulateAuthzOptions) {
    return this.dbInstance.replaceOne(this.name, filterQuery, query, options);
  }

  updateOne(filterQuery: Query<T>, query: Query<T>, options?: PopulateAuthzOptions) {
    return this.dbInstance.updateOne(this.name, filterQuery, query, options);
  }

  updateMany(filterQuery: Query<T>, query: Query<T>, options?: PopulateAuthzOptions) {
    return this.dbInstance.updateMany(this.name, filterQuery, query, options);
  }

  deleteOne(query: Query<T>, options?: AuthzOptions) {
    return this.dbInstance.deleteOne(this.name, query, options);
  }

  deleteMany(query: Query<T>, options?: AuthzOptions) {
    return this.dbInstance.deleteMany(this.name, query, options);
  }

  countDocuments(query: Query<T>, options?: CountDocumentsOptions): Promise<number> {
    return this.dbInstance.countDocuments(this.name, query, options);
  }
}
