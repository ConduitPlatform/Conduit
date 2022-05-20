import {
  ConduitModel,
  ConduitModelOptions,
  ConduitSchema,
  ConduitSchemaExtension,
} from '@conduitplatform/grpc-sdk';
import { ParsedQuery, SchemaAdapter } from './SchemaAdapter';

export class ConduitDatabaseSchema extends ConduitSchema {
  private readonly model: SchemaAdapter<any>;
  extensions: any[];

  constructor(
    model: SchemaAdapter<any>,
    name: string,
    ownerModule: string,
    extensions: any[] = [],
    fields?: ConduitModel,
    modelOptions?: ConduitModelOptions,
    collectionName?: string,
  ) {
    super(name, fields ?? {}, modelOptions, collectionName);
    this.model = model;
    this.ownerModule = ownerModule;
    this.extensions = extensions;
  }

  findOne(
    query: ParsedQuery,
    select?: string,
    populate?: string[] | undefined
  ) {
    return this.model.findOne(query, select, populate);
  }

  findMany(
    query: ParsedQuery,
    select?: string,
    skip?: number,
    limit?: number,
    sort?: { [key: string]: number } | string[],
    populate?: string[] | undefined
  ) {
    return this.model.findMany(query, skip, limit, select, sort, populate);
  }

  create(query: ParsedQuery) {
    return this.model.create(query);
  }

  createMany(query: [{ [key: string]: any }]) {
    return this.model.createMany(query);
  }

  findByIdAndUpdate(
    id: string,
    document: ParsedQuery,
    updateProvidedOnly?: boolean,
    populate?: string[] | undefined,
    relations?: any
  ) {
    return this.model.findByIdAndUpdate(
      id,
      document,
      updateProvidedOnly,
      populate,
      relations
    );
  }

  updateMany(
    filterQuery: ParsedQuery,
    query: ParsedQuery,
    updateProvidedOnly?: boolean
  ) {
    return this.model.updateMany(filterQuery, query, updateProvidedOnly);
  }

  deleteOne(query: ParsedQuery) {
    return this.model.deleteOne(query);
  }

  deleteMany(query: ParsedQuery) {
    return this.model.deleteMany(query);
  }

  countDocuments(query: ParsedQuery): Promise<number> {
    return this.model.countDocuments(query);
  }
}
