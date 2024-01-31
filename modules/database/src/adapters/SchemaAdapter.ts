import ConduitGrpcSdk, { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import { MongooseSchema } from './mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from './sequelize-adapter/SequelizeSchema.js';
import { DatabaseAdapter } from './DatabaseAdapter.js';
import { isEmpty, isNil } from 'lodash-es';
import { createHash } from 'crypto';
import { Op } from 'sequelize';

export type SingleDocQuery = string | Indexable;
export type MultiDocQuery = string | Indexable[];
export type Query = SingleDocQuery | MultiDocQuery;
export type ParsedQuery = Indexable;
export type Doc = ParsedQuery;
export type Fields = ParsedQuery;
export type Schema = MongooseSchema | SequelizeSchema;

export abstract class SchemaAdapter<T> {
  /**
   * The actual underlying model
   */
  model: T;
  /**
   * The original model used to generate this
   */
  originalSchema: ConduitSchema;
  /**
   * A hash of the schema's compiled fields object
   */
  fieldHash: string;

  protected constructor(
    readonly grpcSdk: ConduitGrpcSdk,
    readonly adapter: DatabaseAdapter<any>,
    readonly isView: boolean = false,
  ) {}

  get authzEnabled() {
    return this.originalSchema.modelOptions.conduit?.authorization?.enabled;
  }

  transformViewName(...names: string[]): string {
    return createHash('sha256').update(names.join('_')).digest('hex');
  }

  async permissionCheck(
    operation: string,
    userId?: string,
    scope?: string,
  ): Promise<SchemaAdapter<T> | undefined> {
    const model = this.originalSchema.name;
    if (this.isView) {
      return undefined;
    }
    if ((!userId && !scope) || !this.authzEnabled) {
      return undefined;
    }
    const isAvailable = this.grpcSdk.isAvailable('authorization');
    if (!isAvailable) {
      throw new Error('Authorization service is not available');
    }
    if (scope) {
      // check user permissions only if user is provided
      if (userId) {
        const allowed = await this.grpcSdk.authorization?.can({
          subject: `User:${userId}`,
          actions: [operation],
          resource: scope,
        });
        if (!allowed?.allow) {
          throw new Error(`User:${userId} is not allowed to ${operation} ${scope}`);
        }
      }
      const viewName = this.transformViewName(model, scope, operation);
      let view = this.adapter.views[viewName];
      if (!view) {
        await this.guaranteeView(operation, userId, scope);
        view = this.adapter.views[viewName];
        if (!view) {
          view = await this.adapter.guaranteeView(viewName);
        }
      }
      return view;
    } else {
      const viewName = this.transformViewName(model, 'User:' + userId!, operation);
      let view = this.adapter.views[viewName];
      if (!view) {
        await this.guaranteeView(operation, userId);
        view = this.adapter.views[viewName];
        if (!view) {
          view = await this.adapter.guaranteeView(viewName);
        }
      }
      return view;
    }
  }

  async createPermissionCheck(userId?: string, scope?: string): Promise<void> {
    if (this.isView) {
      throw new Error('Cannot create on view');
    }
    if ((!userId && !scope) || !this.authzEnabled) return;
    const isAvailable = this.grpcSdk.isAvailable('authorization');
    if (!isAvailable) {
      throw new Error('Authorization service is not available');
    }
    if (scope) {
      // check user permissions only if user is provided
      if (userId) {
        const allowed = await this.grpcSdk.authorization?.can({
          subject: `User:${userId}`,
          actions: ['edit'],
          resource: scope,
        });
        if (!allowed?.allow) {
          throw new Error(`User:${userId} is not allowed to edit ${scope}`);
        }
      }
    }
  }

  async guaranteeView(operation: string, userId?: string, scope?: string) {
    await this.grpcSdk.authorization?.createResourceAccessList({
      subject: scope ?? `User:${userId}`,
      action: operation,
      resourceType: this.originalSchema.name,
    });
  }

  async getAuthorizedQuery(
    operation: string,
    query: Indexable,
    many: boolean = false,
    userId?: string,
    scope?: string,
  ) {
    if (!this.authzEnabled || (isNil(userId) && isNil(scope))) return query;
    const view = await this.permissionCheck(operation, userId, scope);
    if (!view) return query;
    if (many) {
      const docs = await view.findMany(query, {
        select: '_id',
        userId: undefined,
        scope: undefined,
      });
      if (isEmpty(docs)) {
        return null;
      }
      if (this.adapter.getDatabaseType() === 'MongoDB') {
        return { _id: { $in: docs.map((doc: any) => doc._id) } };
      } else {
        return { _id: { [Op.in]: docs.map((doc: any) => doc._id) } };
      }
    } else {
      const doc = await view.findOne(query, {
        userId: undefined,
        scope: undefined,
      });
      if (isNil(doc)) {
        return null;
      }
      return { _id: doc._id };
    }
  }

  async getPaginatedAuthorizedQuery(
    operation: string,
    query: Indexable,
    userId?: string,
    scope?: string,
    skip?: number,
    limit?: number,
    sort?: Indexable,
  ) {
    if (!this.authzEnabled || (isNil(userId) && isNil(scope)))
      return { query, modified: false };
    const view = await this.permissionCheck(operation, userId, scope);
    if (!view) return { query, modified: false };
    const docs = await view.findMany(query, {
      select: '_id',
      skip,
      limit,
      sort,
      userId: undefined,
      scope: undefined,
    });
    if (!docs?.length) {
      return { query: null, modified: false };
    }
    return {
      query: { _id: { $in: docs.map((doc: any) => doc._id) } },
      modified: true,
    };
  }

  async addPermissionToData(
    data: Indexable | Indexable[],
    options?: { userId?: string; scope?: string },
  ) {
    if (!this.authzEnabled) return;
    if (!options || (!options?.userId && options?.scope)) {
      return;
    }
    const subject = options.scope ?? `User:${options.userId}`;
    const relation = 'owner';
    if (Array.isArray(data)) {
      const resources = data.map(d => `${this.originalSchema.name}:${d._id}`);
      await this.grpcSdk.authorization?.createRelations(subject, relation, resources);
    } else {
      await this.grpcSdk.authorization?.createRelation({
        subject,
        relation,
        resource: `${this.originalSchema.name}:${data._id}`,
      });
    }
  }

  async canUpdate(assetId: string, userId?: string, scope?: string) {
    if (this.isView) {
      throw new Error('Cannot update a view');
    }
    if (!userId && !scope) {
      return true;
    }
    const allowed = await this.grpcSdk.authorization?.can({
      subject: scope ?? `User:${userId}`,
      actions: ['edit'],
      resource: `${this.originalSchema.name}:${assetId}`,
    });
    if (!allowed || !allowed.allow) {
      throw new Error('Not allowed to update');
    }
    return true;
  }

  abstract parseStringToQuery(
    query: Query | SingleDocQuery | MultiDocQuery,
  ): ParsedQuery | ParsedQuery[];

  /**
   * Should find one
   */
  abstract findOne(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
      select?: string;
      populate?: string[];
    },
  ): Promise<any>;

  /**
   * Should find Many
   * @param query
   * @param options
   */
  abstract findMany(
    query: Query,
    options?: {
      skip?: number;
      limit?: number;
      select?: string;
      sort?: any;
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  /**
   * Should create
   * @param query
   * @param options
   */
  abstract create(
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract createMany(
    query: MultiDocQuery,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract deleteOne(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract deleteMany(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ): Promise<any>;

  abstract findByIdAndReplace(
    id: string,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ): Promise<any>;

  abstract replaceOne(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract updateOne(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ): Promise<any>;

  abstract updateMany(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ): Promise<any>;

  abstract countDocuments(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ): Promise<number>;

  abstract columnExistence(columns: string[]): Promise<boolean>;
}
