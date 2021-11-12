import _, { isNil } from 'lodash';
import { DataTypes, FindOptions, ModelCtor, Sequelize } from 'sequelize';
import { SchemaAdapter } from '../../interfaces';
import { parseQuery } from './utils';
import { createWithPopulations } from './utils';
import { SequelizeAdapter } from './index';
const deepdash = require('deepdash/standalone');

export class SequelizeSchema implements SchemaAdapter<ModelCtor<any>> {
  model: ModelCtor<any>;
  originalSchema: any;
  excludedFields: any[];
  relations: any;

  constructor(
    sequelize: Sequelize,
    schema: any,
    originalSchema: any,
    private readonly adapter: SequelizeAdapter
  ) {
    this.originalSchema = originalSchema;
    this.excludedFields = [];
    this.relations = {};
    const self = this;

    deepdash.eachDeep(
      this.originalSchema.modelSchema,
      (value: any, key: any, parentValue: any, context: any) => {
        if (!parentValue?.hasOwnProperty(key)) {
          return true;
        }

        if (parentValue[key].hasOwnProperty('select')) {
          if (!parentValue[key].select) {
            self.excludedFields.push(key);
          }
        }

        if (
          parentValue[key].hasOwnProperty('type') &&
          parentValue[key].type === 'Relation'
        ) {
          this.relations[key] = parentValue[key].model;
        }
      }
    );

    schema.modelSchema._id = {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    };

    this.model = sequelize.define(schema.name, schema.modelSchema as any, {
      ...schema.modelOptions,
      freezeTableName: true,
    });
  }

  sync() {
    return this.model.sync({ alter: true });
  }

  private async createWithPopulations(document: any): Promise<any> {
    return createWithPopulations(this.originalSchema.fields, document, this.adapter);
  }

  async create(query: string): Promise<any> {
    let parsedQuery = JSON.parse(query);
    parsedQuery.createdAt = new Date();
    parsedQuery.updatedAt = new Date();
    await this.createWithPopulations(parsedQuery);
    return this.model.create(parsedQuery, { raw: true });
  }

  async createMany(query: string): Promise<any> {
    let parsedQuery: any[] = JSON.parse(query);
    let date = new Date();
    for (const doc of parsedQuery) {
      doc.createdAt = date;
      doc.updatedAt = date;
      await this.createWithPopulations(doc);
    }

    return this.model.bulkCreate(parsedQuery);
  }

  async findOne(
    query: string,
    select?: string,
    populate?: string[],
    relations?: any
  ): Promise<any> {
    let parsedQuery = JSON.parse(query);
    let options: FindOptions = { where: parseQuery(parsedQuery), raw: true };
    options.attributes = { exclude: [...this.excludedFields] };
    if (!isNil(select) && select !== '') {
      options.attributes = this.parseSelect(select);
    }

    let document = await this.model.findOne(options);

    if (!isNil(populate) && !isNil(relations)) {
      for (const relation of populate) {
        if (this.relations.hasOwnProperty(relation)) {
          if (relations.hasOwnProperty(this.relations[relation])) {
            document[relation] = await relations[this.relations[relation]].findOne({
              _id: document[relation],
            });
          }
        }
      }
    }

    return document;
  }

  async findMany(
    query: string,
    skip?: number,
    limit?: number,
    select?: string,
    sort?: any,
    populate?: string[],
    relations?: any
  ): Promise<any> {
    let parsedQuery = JSON.parse(query);
    let options: FindOptions = { where: parseQuery(parsedQuery), raw: true };
    options.attributes = { exclude: [...this.excludedFields] };
    if (!isNil(skip)) {
      options.offset = skip;
    }
    if (!isNil(limit)) {
      options.limit = limit;
    }
    if (!isNil(select) && select !== '') {
      options.attributes = this.parseSelect(select);
    }
    if (!isNil(sort)) {
      options.order = sort;
    }

    const documents = await this.model.findAll(options);

    if (!isNil(populate) && !isNil(relations)) {
      for (const relation of populate) {
        let cache: any = {};
        for (const document of documents) {
          if (this.relations.hasOwnProperty(relation)) {
            if (relations.hasOwnProperty(this.relations[relation])) {
              if (!cache.hasOwnProperty(document[relation])) {
                cache[document[relation]] = await relations[
                  this.relations[relation]
                ].findOne({ _id: document[relation] });
              }
              document[relation] = cache[document[relation]];
            }
          }
        }
      }
    }

    return documents;
  }

  deleteOne(query: string): Promise<any> {
    let parsedQuery = JSON.parse(query);
    return this.model.destroy({ where: parseQuery(parsedQuery), limit: 1 });
  }

  deleteMany(query: string): Promise<any> {
    let parsedQuery = JSON.parse(query);
    return this.model.destroy({ where: parseQuery(parsedQuery) });
  }

  async findByIdAndUpdate(
    id: string,
    query: string,
    updateProvidedOnly: boolean = false,
    populate?: string[],
    relations?: any
  ): Promise<any> {
    let parsedQuery = JSON.parse(query);
    if (parsedQuery.hasOwnProperty('$inc')) {
      await this.model
        .increment(parsedQuery['$inc'], { where: { _id: id } })
        .catch(console.error);
      delete parsedQuery['$inc'];
    }

    if (updateProvidedOnly) {
      const record = await this.model.findByPk(id, { raw: true }).catch(console.error);
      if (!isNil(record)) {
        parsedQuery = { ...record, ...parsedQuery };
      }
    } else if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
      const record = await this.model.findByPk(id, { raw: true }).catch(console.error);
      if (!isNil(record)) {
        parsedQuery = { ...record, ...parsedQuery };
      }
    }

    if (parsedQuery.hasOwnProperty('$push')) {
      for (const key in parsedQuery['$push']) {
        await this.model
          .update(
            {
              [key]: Sequelize.fn(
                'array_append',
                Sequelize.col(key),
                parsedQuery['$push'][key]
              ),
            },
            { where: { _id: id } }
          )
          .catch(console.error);
      }
      delete parsedQuery['$push'];
    }

    if (parsedQuery.hasOwnProperty('$pull')) {
      let dbDocument = await this.model.findByPk(id).catch(console.error);
      for (const key in parsedQuery['$push']) {
        const ind = dbDocument[key].indexOf(parsedQuery['$push'][key]);
        if (ind > -1) {
          dbDocument[key].splice(ind, 1);
        }
      }
      await this.model.update(parsedQuery, { where: { _id: id } }).catch(console.error);
      delete parsedQuery['$pull'];
    }

    parsedQuery.updatedAt = new Date();
    await this.createWithPopulations(parsedQuery);
    let document = (await this.model.upsert({ _id: id, ...parsedQuery }))[0];
    if (!isNil(populate) && !isNil(relations)) {
      for (const relation of populate) {
        let cache: any = {};
          if (this.relations.hasOwnProperty(relation)) {
            if (relations.hasOwnProperty(this.relations[relation])) {
              if (!cache.hasOwnProperty(document[relation])) {
                cache[document[relation]] = await relations[
                  this.relations[relation]
                  ].findOne({ _id: document[relation] });
              }
              document[relation] = cache[document[relation]];
            }
          }
      }
    }

    return document;
  }

  async updateMany(
    filterQuery: string,
    query: string,
    updateProvidedOnly: boolean = false
  ): Promise<any> {
    let parsedQuery = JSON.parse(query);
    let parsedFilter = JSON.parse(filterQuery);
    parsedFilter = parseQuery(parsedFilter);
    if (query.hasOwnProperty('$inc')) {
      await this.model
        .increment(parsedQuery['$inc'] as any, { where: parsedFilter })
        .catch(console.error);
      delete parsedQuery['$inc'];
    }

    if (updateProvidedOnly) {
      const record = await this.model
        .findOne({ where: parsedFilter, raw: true })
        .catch(console.error);
      if (!isNil(record)) {
        parsedQuery = _.mergeWith(record, parsedQuery);
      }
    }

    if (parsedQuery.hasOwnProperty('$push')) {
      for (const key in parsedQuery['$push']) {
        await this.model
          .update(
            {
              [key]: Sequelize.fn(
                'array_append',
                Sequelize.col(key),
                parsedQuery['$push'][key]
              ),
            },
            { where: parsedFilter }
          )
          .catch(console.error);
      }
      delete parsedQuery['$push'];
    }

    if (parsedQuery.hasOwnProperty('$pull')) {
      let documents = await this.findMany(filterQuery).catch(console.error);
      for (let document of documents) {
        for (const key in parsedQuery['$push']) {
          const ind = document[key].indexOf(parsedQuery['$push'][key]);
          if (ind > -1) {
            document[key].splice(ind, 1);
          }
        }
        await this.model.update(document, { where: parsedFilter }).catch(console.error);
      }
      delete parsedQuery['$pull'];
    }

    parsedQuery.updatedAt = new Date();
    await this.createWithPopulations(parsedQuery);
    return this.model.update(parsedQuery, { where: parsedFilter });
  }

  countDocuments(query: any): Promise<number> {
    let parsedQuery = JSON.parse(query);
    return this.model.count({ where: parseQuery(parsedQuery) });
  }

  private parseSelect(select: string): string[] | { exclude: string[] } {
    let include = [];
    let exclude = [...this.excludedFields];
    let attributes = select.split(' ');
    let returnInclude = false;

    for (const attribute of attributes) {
      if (attribute[0] === '+') {
        const tmp = attribute.slice(1);
        include.push(tmp);

        const ind = exclude.indexOf(tmp);
        if (ind > -1) {
          exclude.splice(ind, 1);
        }
      } else if (attribute[0] === '-') {
        exclude.push(attribute.slice(1));
      } else {
        include.push(attribute);
        returnInclude = true;
      }
    }

    if (returnInclude) {
      return include;
    }

    return { exclude };
  }
}
