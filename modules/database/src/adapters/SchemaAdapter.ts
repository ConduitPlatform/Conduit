import ConduitGrpcSdk, { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import { MongooseSchema } from './mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from './sequelize-adapter/SequelizeSchema';
import { DatabaseAdapter } from './DatabaseAdapter';
import { isNil } from 'lodash';

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

  transformViewName(...names: string[]): string {
    return names.join('_');
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
    if (!userId && !scope) {
      return undefined;
    }
    const isAvailable = this.grpcSdk.isAvailable('authorization');
    if (!isAvailable) {
      throw new Error('Authorization service is not available');
    }
    if (scope) {
      const allowed = await this.grpcSdk.authorization?.can({
        subject: `User:${userId}`,
        actions: [operation],
        resource: scope,
      });
      if (!allowed?.allow) {
        throw new Error(`User:${userId} is not allowed to ${operation} ${scope}`);
      }
      const view = this.adapter.views[this.transformViewName(operation, scope, model)];
      if (!view) {
        await this.guaranteeView(operation, userId, scope);
      }
      return view;
    } else {
      const view = this.adapter.views[this.transformViewName(operation, userId!, model)];
      if (!view) {
        await this.guaranteeView(operation, userId);
      }
      return view;
    }
  }

  async createPermissionCheck(userId?: string, scope?: string): Promise<void> {
    if (this.isView) {
      throw new Error('Cannot create on view');
    }
    if (!userId && !scope) return;
    const isAvailable = this.grpcSdk.isAvailable('authorization');
    if (!isAvailable) {
      throw new Error('Authorization service is not available');
    }
    if (scope) {
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

  async guaranteeView(operation: string, userId?: string, scope?: string) {
    await this.grpcSdk.authorization?.createResourceAccessList({
      subject: scope ?? `User:${userId}`,
      action: operation,
      resourceType: this.originalSchema.name,
    });
  }

  async getAuthorizedQuery(
    operation: string,
    parsedQuery: Indexable,
    many: boolean = false,
    userId?: string,
    scope?: string,
    skip?: number,
    limit?: number,
  ) {
    if (!isNil(userId) || !isNil(scope)) {
      const view = await this.permissionCheck(operation, userId, scope);
      if (!view) return parsedQuery;
      if (many) {
        const docs = await view.findMany(parsedQuery, {
          select: '_id',
          skip,
          limit,
          userId: undefined,
          scope: undefined,
        });
        return { _id: { $in: docs.map((doc: any) => doc._id) } };
      } else {
        const doc = await view.findOne(parsedQuery, {
          userId: undefined,
          scope: undefined,
        });
        return { _id: doc._id };
      }
    }
    return parsedQuery;
  }

  async addPermissionToData(
    data: Indexable | Indexable[],
    options?: { userId?: string; scope?: string },
  ) {
    if (!options || (!options?.userId && options?.scope)) {
      return;
    }
    if (Array.isArray(data)) {
      for (const d of data) {
        await this.addPermissionToData(d, options);
      }
    } else {
      await this.grpcSdk.authorization?.createRelation({
        subject: options.scope ?? `User:${options.userId}`,
        relation: 'owner',
        resource: `${this.originalSchema.name}:${data._id}}`,
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
