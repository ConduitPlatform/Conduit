import {
  ConduitModel,
  ConduitModelOptions,
  ConduitSchema,
  ConduitSchemaExtension,
} from '@conduitplatform/grpc-sdk';
import { SchemaAdapter } from './SchemaAdapter';

export class ConduitDatabaseSchema<T> extends ConduitSchema {
  private readonly model: SchemaAdapter<any>;
  readonly extensions: ConduitSchemaExtension[];

  constructor(
    model: SchemaAdapter<any>,
    name: string,
    ownerModule: string,
    fields?: ConduitModel,
    modelOptions?: ConduitModelOptions,
    collectionName?: string,
    extensions?: any[]
  ) {
    super(name, fields ?? {}, modelOptions, collectionName);
    this.model = model;
    this.ownerModule = ownerModule;
    this.extensions = extensions ?? [];
  }

  findOne(
    query: { [key: string]: any },
    select?: string,
    populate?: string[] | undefined
  ): Promise<any> {
    return this.model.findOne(query, select, populate);
  }

  findMany(
    query: { [key: string]: any },
    select?: string,
    skip?: number,
    limit?: number,
    sort?: { [key: string]: number } | string[],
    populate?: string[] | undefined
  ): Promise<any> {
    return this.model.findMany(query, skip, limit, select, sort, populate);
  }

  create(query: { [key: string]: any }): Promise<any> {
    return this.model.create(query);
  }

  createMany(query: [{ [key: string]: any }]): Promise<any> {
    return this.model.createMany(query);
  }

  findByIdAndUpdate(
    id: string,
    document: { [key: string]: any },
    updateProvidedOnly?: boolean,
    populate?: string[] | undefined,
    relations?: any
  ): Promise<any> {
    return this.model.findByIdAndUpdate(
      id,
      document,
      updateProvidedOnly,
      populate,
      relations
    );
  }

  updateMany(
    filterQuery: { [key: string]: any },
    query: { [key: string]: any },
    updateProvidedOnly?: boolean
  ): Promise<any> {
    return this.model.updateMany(filterQuery, query, updateProvidedOnly);
  }

  deleteOne(query: { [key: string]: any }): Promise<any> {
    return this.model.deleteOne(query);
  }

  deleteMany(query: { [key: string]: any }): Promise<any> {
    return this.model.deleteMany(query);
  }

  countDocuments(query: { [key: string]: any }): Promise<number> {
    return this.model.countDocuments(query);
  }
}
