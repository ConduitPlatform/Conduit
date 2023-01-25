import {
  ConduitModel,
  ConduitSchemaOptions,
  ConduitSchema,
} from '@conduitplatform/grpc-sdk';
import { DeclaredSchemaExtension } from './DeclaredSchemaExtension';
import { MultiDocQuery, ParsedQuery, Schema, SchemaAdapter } from './SchemaAdapter';

export class ConduitDatabaseSchema extends ConduitSchema {
  private readonly model: SchemaAdapter<Schema>;
  extensions: DeclaredSchemaExtension[];
  compiledFields: ConduitModel;

  constructor(
    model: SchemaAdapter<Schema>,
    name: string,
    ownerModule: string,
    fields: ConduitModel,
    extensions: DeclaredSchemaExtension[] = [],
    modelOptions?: ConduitSchemaOptions,
    collectionName?: string,
  ) {
    super(name, fields ?? {}, modelOptions, collectionName);
    this.model = model;
    this.ownerModule = ownerModule;
    this.extensions = extensions;
  }

  findOne(query: ParsedQuery, select?: string, populate?: string[] | undefined) {
    return this.model.findOne(query, select, populate);
  }

  findMany(
    query: ParsedQuery,
    select?: string,
    skip?: number,
    limit?: number,
    sort?: { [key: string]: number } | string[],
    populate?: string[] | undefined,
  ) {
    return this.model.findMany(query, skip, limit, select, sort, populate);
  }

  create(query: ParsedQuery) {
    return this.model.create(query);
  }

  createMany(query: MultiDocQuery) {
    return this.model.createMany(query);
  }

  findByIdAndUpdate(id: string, document: ParsedQuery, populate?: string[] | undefined) {
    return this.model.findByIdAndUpdate(id, document, populate);
  }

  updateMany(
    filterQuery: ParsedQuery,
    query: ParsedQuery,
    populate?: string[] | undefined,
  ) {
    return this.model.updateMany(filterQuery, query, populate);
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
