import { Query } from '../../types';

export type FindOneParams<T> =
  | {
      schemaName: string;
      query: Query<T>;
      select?: string;
      populate?: string | string[];
      userId?: string;
      scope?: string;
    }[]
  | [
      schemaName: string,
      query: Query<T>,
      select?: string,
      populate?: string | string[],
      userId?: string,
      scope?: string,
    ];

export enum FindOneParamEnum {
  schemaName = 'schemaName',
  query = 'query',
  select = 'select',
  populate = 'populate',
  userId = 'userId',
  scope = 'scope',
}

export type FindManyParams<T> =
  | {
      schemaName: string;
      query: Query<T>;
      select?: string;
      skip?: number;
      limit?: number;
      sort?: { [field: string]: -1 | 1 } | string[] | string;
      populate?: string | string[];
      userId?: string;
      scope?: string;
    }[]
  | [
      schemaName: string,
      query: Query<T>,
      select?: string,
      skip?: number,
      limit?: number,
      sort?: { [field: string]: -1 | 1 } | string[] | string,
      populate?: string | string[],
      userId?: string,
      scope?: string,
    ];

export enum FindManyParamEnum {
  schemaName = 'schemaName',
  query = 'query',
  select = 'select',
  skip = 'skip',
  limit = 'limit',
  sort = 'sort',
  populate = 'populate',
  userId = 'userId',
  scope = 'scope',
}

export type CreateParams<T> =
  | {
      schemaName: string;
      query: Query<T>;
      userId?: string;
      scope?: string;
    }[]
  | [schemaName: string, query: Query<T>, userId?: string, scope?: string];

export enum CreateParamEnum {
  schemaName = 'schemaName',
  query = 'query',
  userId = 'userId',
  scope = 'scope',
}

export type CreateManyParams<T> =
  | {
      schemaName: string;
      query: Query<T>[];
      userId?: string;
      scope?: string;
    }[]
  | [schemaName: string, query: Query<T>[], userId?: string, scope?: string];

export const CreateManyParamEnum = CreateParamEnum;

export type FindByIdAndUpdateParams<T> =
  | {
      schemaName: string;
      id: string;
      document: Query<T>;
      populate?: string | string[];
      userId?: string;
      scope?: string;
    }[]
  | [
      schemaName: string,
      id: string,
      document: Query<T>,
      populate?: string | string[],
      userId?: string,
      scope?: string,
    ];

export enum FindByIdAndUpdateParamEnum {
  schemaName = 'schemaName',
  id = 'id',
  document = 'document',
  populate = 'populate',
  userId = 'userId',
  scope = 'scope',
}

export type FindByIdAndReplaceParams<T> = FindByIdAndUpdateParams<T>;

export const FindByIdAndReplaceEnum = FindByIdAndUpdateParamEnum;

export type UpdateManyParams<T> =
  | {
      schemaName: string;
      filterQuery: Query<T>;
      query: Query<T>;
      populate?: string | string[];
      userId?: string;
      scope?: string;
    }[]
  | [
      schemaName: string,
      filterQuery: Query<T>,
      query: Query<T>,
      populate?: string | string[],
      userId?: string,
      scope?: string,
    ];

export enum UpdateManyParamEnum {
  schemaName = 'schemaName',
  filterQuery = 'filterQuery',
  query = 'query',
  populate = 'populate',
  userId = 'userId',
  scope = 'scope',
}

export type UpdateOneParams<T> = UpdateManyParams<T>;

export const UpdateOneParamEnum = UpdateManyParamEnum;

export type ReplaceOneParams<T> = UpdateOneParams<T>;

export const ReplaceOneParamEnum = UpdateOneParamEnum;

export type DeleteOneParams<T> = CreateParams<T>;

export const DeleteOneParamEnum = CreateParamEnum;

export type DeleteManyParams<T> = DeleteOneParams<T>;

export const DeleteManyParamEnum = DeleteOneParamEnum;

export type CountDocumentsParams<T> = CreateParams<T>;

export const CountDocumentsParamEnum = CreateParamEnum;
