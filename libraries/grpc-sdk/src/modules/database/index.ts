import { ConduitModule, ConduitSchema } from '../../classes/index.js';
import {
  DatabaseProviderDefinition,
  DropCollectionResponse,
  Schema,
} from '../../protoUtils/database.js';
import {
  ConduitSchemaExtension,
  Indexable,
  RawQuery,
  UntypedArray,
} from '../../interfaces/index.js';
import { Query } from '../../types/db.js';
import type { FindOneOptions, FindManyOptions } from './types.js';
export type { FindOneOptions, FindManyOptions } from './types.js';
import { AuthzOptions, PopulateAuthzOptions } from '../../types/options.js';
import type {
  VectorCapabilities,
  VectorIndexDefinition,
  VectorSearchInput,
  VectorSearchResult,
} from '../../interfaces/Model.js';
import { defaultVectorIndexMethod } from '../../interfaces/Model.js';

import {
  CountDocumentsOptions,
  findManyRequest,
  findOneRequest,
  processQuery,
  queryRequest,
  updateManyRequest,
  updateRequest,
} from './requests.js';
import {
  DatabaseOperations,
  DatabaseTransaction,
  isRetryableTransactionError,
  TransactionOptions,
  TransactionUnavailableError,
} from './transaction.js';
import { getLogger } from '../../utilities/GrpcSdkContext.js';
export type { CountDocumentsOptions } from './requests.js';
export { DatabaseTransaction, TransactionUnavailableError } from './transaction.js';
export type { DatabaseOperations, TransactionOptions } from './transaction.js';

/** How long a refused transaction is remembered before Database is asked again. */
const TRANSACTION_SUPPORT_RECHECK_MS = 60_000;

export class DatabaseProvider
  extends ConduitModule<typeof DatabaseProviderDefinition>
  implements DatabaseOperations
{
  private transactionsUnavailableUntil = 0;
  private transactionFallbackLogged = false;

  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'database', url, grpcToken);
    this.initializeClient(DatabaseProviderDefinition);
  }

  getSchema(schemaName: string): Promise<{
    name: string;
    fields: any;
    modelOptions: any;
    collectionName: string;
    fieldHash: string;
  }> {
    return this.client!.getSchema({ schemaName: schemaName }).then(res => {
      return {
        name: res.name,
        fields: JSON.parse(res.fields),
        modelOptions: JSON.parse(res.modelOptions),
        collectionName: res.collectionName,
        fieldHash: res.fieldHash,
      };
    });
  }

  getSchemas(): Promise<
    {
      name: string;
      fields: any;
      modelOptions: any;
      fieldHash: string;
    }[]
  > {
    return this.client!.getSchemas({}).then(res => {
      return res.schemas.map(
        (schema: {
          name: string;
          fields: string;
          modelOptions: string;
          collectionName: string;
          fieldHash: string;
        }) => {
          return {
            name: schema.name,
            fields: JSON.parse(schema.fields),
            modelOptions: JSON.parse(schema.modelOptions),
            collectionName: schema.collectionName,
            fieldHash: schema.fieldHash,
          };
        },
      );
    });
  }

  deleteSchema(schemaName: string, deleteData: boolean): Promise<DropCollectionResponse> {
    return this.client!.deleteSchema({ schemaName, deleteData });
  }

  createSchemaFromAdapter(schema: ConduitSchema): Promise<Schema> {
    return this.client!.createSchemaFromAdapter({
      name: schema.name,
      fields: JSON.stringify(schema.fields),
      modelOptions: JSON.stringify(schema.modelOptions),
      collectionName: schema.collectionName,
    }).then(res => {
      return {
        name: res.name,
        fields: JSON.parse(res.fields),
        modelOptions: JSON.parse(res.modelOptions),
        collectionName: res.collectionName,
        fieldHash: res.fieldHash,
      };
    });
  }

  setSchemaExtension(extension: ConduitSchemaExtension): Promise<Schema> {
    return this.client!.setSchemaExtension({
      schemaName: extension.schemaName,
      fields: JSON.stringify(extension.fields),
    }).then(res => {
      return {
        name: res.name,
        fields: JSON.parse(res.fields),
        modelOptions: JSON.parse(res.modelOptions),
        collectionName: res.collectionName,
        fieldHash: res.fieldHash,
      };
    });
  }

  processQuery<T>(query: Query<T> | Query<T>[]) {
    return processQuery(query);
  }

  findOne<T>(schemaName: string, query: Query<T>, options?: FindOneOptions): Promise<T> {
    return this.client!.findOne(findOneRequest(schemaName, query, options)).then(res =>
      JSON.parse(res.result),
    );
  }

  findMany<T>(
    schemaName: string,
    query: Query<T>,
    options?: FindManyOptions,
  ): Promise<T[]> {
    return this.client!.findMany(findManyRequest(schemaName, query, options)).then(res =>
      JSON.parse(res.result),
    );
  }

  create<T>(schemaName: string, query: Query<T>, options?: AuthzOptions): Promise<T> {
    return this.client!.create(queryRequest(schemaName, query, options)).then(res =>
      JSON.parse(res.result),
    );
  }

  createMany<T>(
    schemaName: string,
    query: Query<T>[],
    options?: AuthzOptions,
  ): Promise<T[] | UntypedArray> {
    return this.client!.createMany(queryRequest(schemaName, query, options)).then(res =>
      JSON.parse(res.result),
    );
  }

  findByIdAndUpdate<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | any> {
    return this.client!.findByIdAndUpdate({
      ...updateRequest(schemaName, id, document, options),
      embeddingsJob: options?.embeddingsJob,
    }).then(res => JSON.parse(res.result));
  }

  findByIdAndReplace<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | any> {
    return this.client!.findByIdAndReplace(
      updateRequest(schemaName, id, document, options),
    ).then(res => JSON.parse(res.result));
  }

  updateMany<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ) {
    return this.client!.updateMany(
      updateManyRequest(schemaName, filterQuery, query, options),
    ).then(res => JSON.parse(res.result));
  }

  updateOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ) {
    return this.client!.updateOne(
      updateManyRequest(schemaName, filterQuery, query, options),
    ).then(res => JSON.parse(res.result));
  }

  replaceOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ) {
    return this.client!.replaceOne(
      updateManyRequest(schemaName, filterQuery, query, options),
    ).then(res => JSON.parse(res.result));
  }

  deleteOne<T>(schemaName: string, query: Query<T>, options?: AuthzOptions) {
    return this.client!.deleteOne(queryRequest(schemaName, query, options)).then(res =>
      JSON.parse(res.result),
    );
  }

  deleteMany<T>(schemaName: string, query: Query<T>, options?: AuthzOptions) {
    return this.client!.deleteMany(queryRequest(schemaName, query, options)).then(res =>
      JSON.parse(res.result),
    );
  }

  countDocuments<T>(
    schemaName: string,
    query: Query<T>,
    options?: CountDocumentsOptions,
  ): Promise<number> {
    return this.client!.countDocuments(queryRequest(schemaName, query, options)).then(
      res => JSON.parse(res.result),
    );
  }

  /** Whether the connected database can run transactions (SQL, or MongoDB with a replica set). */
  getTransactionSupport(): Promise<{ supported: boolean; message?: string }> {
    return this.client!.getTransactionSupport({});
  }

  /**
   * Runs `work` inside a database transaction: everything it writes through `tx`
   * is committed together when it resolves, and rolled back when it throws.
   *
   * Requires SQL, or MongoDB running as a replica set or sharded cluster.
   * Mutation events and ownership relations of documents created in the
   * transaction are emitted on commit. Calls made on `tx` run one at a time.
   *
   * @example
   * await database.withTransaction(async tx => {
   *   const order = await tx.create('Order', { total });
   *   await tx.updateOne('Stock', { item }, { $inc: { quantity: -1 } });
   * });
   */
  async withTransaction<R>(
    work: (tx: DatabaseTransaction) => Promise<R>,
    options?: TransactionOptions,
  ): Promise<R> {
    const retries = Math.max(0, options?.retries ?? 0);
    for (let attempt = 0; ; attempt++) {
      const tx = new DatabaseTransaction(requests => this.client!.transaction(requests));
      try {
        await tx.begin(options?.timeoutMs);
        const result = await work(tx);
        await tx.commit();
        return result;
      } catch (e) {
        await tx.rollback().catch(() => {});
        if (attempt < retries && isRetryableTransactionError(e)) continue;
        throw e;
      }
    }
  }

  /**
   * Runs `work` inside a transaction when the database supports one, and without
   * one when it does not (standalone MongoDB, or a Database that predates
   * transactions). The fallback is logged and is not atomic: there is no rollback,
   * so a failure part-way leaves the earlier writes in place.
   *
   * `work` receives the transaction, or this provider in the fallback, and has to
   * be correct with either. That rules out, inside `work`:
   * - catching a failed call and carrying on: in a transaction that failure has
   *   already rolled everything back
   * - reading back, with `userId` or `scope`, a document it has just created: in a
   *   transaction the ownership relation is only written on commit
   * - effects outside the database (emails, bus events, calls to other modules):
   *   they are never rolled back, so do them after `work` returns
   *
   * @example
   * await database.withOptionalTransaction(async db => {
   *   await Order.getInstance().create(order, { transaction: db });
   *   await Stock.getInstance().updateOne(filter, update, { transaction: db });
   * });
   */
  async withOptionalTransaction<R>(
    work: (db: DatabaseOperations) => Promise<R>,
    options?: TransactionOptions,
  ): Promise<R> {
    if (Date.now() < this.transactionsUnavailableUntil) return work(this);
    try {
      return await this.withTransaction(work, options);
    } catch (e) {
      // Thrown by begin only, so `work` has not run yet.
      if (!(e instanceof TransactionUnavailableError)) throw e;
      this.transactionsUnavailableUntil = Date.now() + TRANSACTION_SUPPORT_RECHECK_MS;
      if (!this.transactionFallbackLogged) {
        this.transactionFallbackLogged = true;
        getLogger().warn(
          `Database transactions are unavailable (${e.message}); module "${this.moduleName}" runs its multi-step writes without atomicity.`,
        );
      }
      return work(this);
    }
  }

  rawQuery(schemaName: string, query: RawQuery) {
    const processed: any = query;
    if (query.mongoQuery) {
      for (const key of Object.keys(query.mongoQuery)) {
        processed.mongoQuery[key] = JSON.stringify(processed.mongoQuery[key]);
      }
    }
    if (query.sqlQuery?.options) {
      processed.sqlQuery.options = JSON.stringify(query.sqlQuery.options);
    }
    return this.client!.rawQuery({ schemaName, query: processed }).then(res => {
      return JSON.parse(res.result);
    });
  }

  getVectorCapabilities(schemaName?: string): Promise<VectorCapabilities> {
    return this.client!.getVectorCapabilities({ schemaName }).then(res => ({
      supported: res.supported,
      storage: res.storage,
      indexing: res.indexing,
      search: res.search,
      provider: res.provider as VectorCapabilities['provider'],
      reason: res.reason,
    }));
  }

  createVectorIndex(schemaName: string, index: VectorIndexDefinition): Promise<string> {
    return this.client!.createVectorIndex({
      schemaName,
      index: {
        field: index.field,
        dimensions: index.dimensions,
        similarity: index.similarity,
        name: index.name,
        method: defaultVectorIndexMethod(index.method),
        filterFields: [...(index.filterFields ?? [])],
        options: index.options ? JSON.stringify(index.options) : undefined,
      },
    }).then(res => JSON.parse(res.result));
  }

  getVectorIndexes(schemaName: string): Promise<VectorIndexDefinition[]> {
    return this.client!.getVectorIndexes({ schemaName }).then(res =>
      res.indexes.map(index => ({
        field: index.field,
        dimensions: index.dimensions,
        similarity: index.similarity as VectorIndexDefinition['similarity'],
        name: index.name,
        method: defaultVectorIndexMethod(index.method),
        filterFields: index.filterFields,
        options: index.options ? JSON.parse(index.options) : undefined,
        status: index.status as VectorIndexDefinition['status'],
        queryable: index.queryable,
      })),
    );
  }

  deleteVectorIndex(schemaName: string, indexName: string): Promise<string> {
    return this.client!.deleteVectorIndex({ schemaName, indexName }).then(res =>
      JSON.parse(res.result),
    );
  }

  vectorSearch<T = Indexable>(
    request: VectorSearchInput,
  ): Promise<VectorSearchResult<T>[]> {
    return this.client!.vectorSearch({
      schemaName: request.schemaName,
      field: request.field,
      vector: request.vector,
      indexName: request.indexName,
      filter: request.filter ? JSON.stringify(request.filter) : undefined,
      limit: request.limit,
      numCandidates: request.numCandidates,
      select: request.select,
      userId: request.userId,
      scope: request.scope,
      adminOperator: request.adminOperator,
    }).then(res => JSON.parse(res.result));
  }

  createView(
    schemaName: string,
    viewName: string,
    joinedSchemas: string[],
    query: { mongoQuery?: Indexable; sqlQuery?: string },
  ) {
    const processed: any = query;
    if (query.mongoQuery) {
      processed.mongoQuery = JSON.stringify(query.mongoQuery);
    }
    return this.client!.createView({
      schemaName,
      viewName,
      joinedSchemas,
      query: processed,
    });
  }

  deleteView(viewName: string) {
    return this.client!.deleteView({ viewName });
  }

  columnExistence(schemaName: string, columns: string[]) {
    return this.client!.columnExistence({ schemaName, columns }).then(r => r.result);
  }

  migrate(schemaName: string) {
    return this.client!.migrate({ schemaName });
  }

  getDatabaseType() {
    return this.client!.getDatabaseType({});
  }

  generateId(): Promise<string> {
    return this.client!.generateId({}).then(res => res.result);
  }
}
